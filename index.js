require("dotenv").config();
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 3000;
const cors = require("cors");

// middlewares
app.use(
  cors({
    origin: ["http://localhost:5173", "https://elite-explore.netlify.app"],
  })
);

app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.koweo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("EliteExplore").collection("users");
    const toursCollection = client.db("EliteExplore").collection("tours");
    const guidesCollection = client.db("EliteExplore").collection("guides");
    const storiesCollection = client.db("EliteExplore").collection("stories");
    const bookingsCollection = client.db("EliteExplore").collection("bookings");
    const applicationsCollection = client
      .db("EliteExplore")
      .collection("applications");
    const paymentCollection = client.db("EliteExplore").collection("payments");

    // verify user token
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "forbidden access" });
        }
        req.decoded = decoded;

        next();
      });
    };

    // verify a user admin or not
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;

      const query = { email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role == "admin";

      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // verify a user guide or not
    const verifyGuide = async (req, res, next) => {
      const email = req.decoded.email;

      const query = { email };
      const user = await usersCollection.findOne(query);
      const isGuide = user?.role == "guide";

      if (!isGuide) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // jwt related apis
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "10hr",
      });
      res.send({ token });
    });

    // check user admin or not
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        res.status(403).send({ message: "forbidden access" });
      }
      const query = { email };
      const user = await usersCollection.findOne(query);

      let admin = false;
      if (user) {
        admin = user?.role == "admin";
      }
      res.send({ admin });
    });

    // check user guide or not
    app.get("/users/guide/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        res.status(403).send({ message: "forbidden access" });
      }
      const query = { email };
      const user = await usersCollection.findOne(query);

      let guide = false;
      if (user) {
        guide = user?.role == "guide";
      }
      res.send({ guide });
    });

    // data for admin dashboard
    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      // Count Total Tour Guides
      const totalGuides = await guidesCollection.countDocuments();

      // Count Total Packages (using toursCollection)
      const totalPackages = await toursCollection.countDocuments();

      // Count Total Clients (Tourists) - based on usersCollection
      const totalClients = await usersCollection.countDocuments({
        role: "user",
      });

      // Count Total Stories (using storiesCollection)
      const totalStories = await storiesCollection.countDocuments();

      // Response as an array
      res.send([
        { name: "Guides", value: totalGuides },
        { name: "Packages", value: totalPackages },
        { name: "Clients", value: totalClients },
        { name: "Stories", value: totalStories },
      ]);
    });

    // get total payment for admin dashboard
    app.get(
      "/admin-total-payment",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        // Calculate Total Payment
        const totalPayment = await paymentCollection
          .aggregate([{ $group: { _id: null, total: { $sum: "$price" } } }])
          .toArray();

        res.send([{ name: "Payment", value: totalPayment[0]?.total || 0 }]);
      }
    );

    // create payment intent
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      // Create a PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // save payment info
    app.post("/payment", verifyToken, async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);

      const query = { _id: new ObjectId(payment.bookingsId) };

      const updatedDoc = {
        $set: {
          status: "in review",
        },
      };
      const deleteResult = await bookingsCollection.updateOne(
        query,
        updatedDoc
      );
      res.send({ result, deleteResult });
    });

    // get payment history by email
    app.get("/payment/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      // verify the user
      if (email !== req.decoded.email) {
        res.status(403).send({ message: "forbidden access" });
      }

      const query = { email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    // add user
    app.post("/users", async (req, res) => {
      const userData = req.body;
      const email = userData.email;

      const isAxists = await usersCollection.findOne({ email });
      if (isAxists) {
        return;
      }

      const result = await usersCollection.insertOne(userData);
      res.send(result);
    });

    // delete a user
    app.delete(
      "/delete-user/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await usersCollection.deleteOne(query);
        res.send(result);
      }
    );

    // get all user
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const { search, role, page = 1, limit = 10 } = req.query;
      const query = {};

      if (search) {
        query.name = { $regex: search, $options: "i" };
      }

      if (role) {
        query.role = role;
      }

      const skip = (page - 1) * parseInt(limit);

      try {
        const users = await usersCollection
          .find(query)
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();
        const total = await usersCollection.countDocuments(query);

        res.send({
          users,
          total,
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error fetching users" });
      }
    });

    // get user data by email
    app.get("/user/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    // post for a guide application
    app.post("/applications", verifyToken, async (req, res) => {
      const applicationsData = req.body;
      const result = await applicationsCollection.insertOne(applicationsData);
      res.send(result);
    });

    // get all applications
    app.get("/applications", verifyToken, verifyAdmin, async (req, res) => {
      const result = await applicationsCollection.find().toArray();
      res.send(result);
    });

    // accept the tour guide applications
    app.patch(
      "/accept-tour-guide",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const applicantData = req.body;

        const email = applicantData.email;
        const query = { email };

        const updateStatus = {
          $set: {
            role: "guide",
          },
        };
        const updateUserStatus = await usersCollection.updateOne(
          query,
          updateStatus
        );

        const updateguideStatus = await applicationsCollection.updateOne(
          query,
          updateStatus
        );

        const result = await guidesCollection.insertOne(applicantData);
        res.send({ result, updateUserStatus, updateguideStatus });
      }
    );

    // delete the tour guide applications
    app.delete(
      "/reject-tour-guide/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const query = { email };
        const result = await applicationsCollection.deleteOne(query);
        res.send(result);
      }
    );

    // update user profile
    app.patch("/update-profile/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const userData = req.body;
      const query = { _id: new ObjectId(id) };

      const updatedDoc = {
        $set: {
          name: userData.name,
          photo: userData.photo,
        },
      };

      const result = await usersCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // get random tour data
    app.get("/random-tours", async (req, res) => {
      const randomPackages = await toursCollection
        .aggregate([{ $sample: { size: 3 } }])
        .toArray();
      res.json(randomPackages);
    });

    // get random stories
    app.get("/randomStories", async (req, res) => {
      const randomstories = await storiesCollection
        .aggregate([{ $sample: { size: 4 } }])
        .toArray();
      res.json(randomstories);
    });

    // get all stories
    app.get("/stories", async (req, res) => {
      const stories = await storiesCollection.find().toArray();
      res.send(stories);
    });

    // get specific stories by email
    app.get("/stories/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await storiesCollection.find(query).toArray();
      res.send(result);
    });

    // get story by id
    app.get("/story/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await storiesCollection.findOne(query);
      res.send(result);
    });

    // delete a story
    app.delete("/stories/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await storiesCollection.deleteOne(query);
      res.send(result);
    });

    // post a story
    app.post("/add-story", verifyToken, async (req, res) => {
      const storyData = req.body;
      const result = await storiesCollection.insertOne(storyData);
      res.send(result);
    });

    // Update story photos (Add new photos and remove specific ones)

    app.put("/update-story/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { newPhotos, removedPhotos, title, excerpt } = req.body;

      if (!id) {
        return res.status(400).json({ error: "Story ID is required." });
      }

      const query = { _id: new ObjectId(id) };
      let updateDoc = { title, excerpt }; // Always update title and excerpt

      try {
        let updateResult = false;

        // Step 1: Update title and excerpt
        const titleExcerptResult = await storiesCollection.updateOne(query, {
          $set: updateDoc,
        });
        updateResult = titleExcerptResult.modifiedCount > 0;

        // Step 2: Remove the photos that need to be deleted
        if (removedPhotos && removedPhotos.length > 0) {
          const removedPhotosResult = await storiesCollection.updateOne(query, {
            $pull: { photo: { $in: removedPhotos } },
          });
          updateResult = updateResult || removedPhotosResult.modifiedCount > 0;
        }

        // Step 3: Add new photos
        if (newPhotos && newPhotos.length > 0) {
          const newPhotosResult = await storiesCollection.updateOne(query, {
            $push: { photo: { $each: newPhotos } },
          });
          updateResult = updateResult || newPhotosResult.modifiedCount > 0;
        }

        // Check if any changes were made
        if (updateResult) {
          res.status(200).json({ message: "Story updated successfully." });
        } else {
          res.status(400).json({ error: "No changes were made to the story." });
        }
      } catch (error) {
        console.error("Error updating story:", error);
        res.status(500).json({ error: "Failed to update story" });
      }
    });

    // get random guides data
    app.get("/guides", async (req, res) => {
      const randomGuides = await guidesCollection
        .aggregate([{ $sample: { size: 6 } }])
        .toArray();
      res.json(randomGuides);
    });

    // get all guides
    app.get("/allGuides", async (req, res) => {
      const allGuides = await guidesCollection.find().toArray();
      res.send(allGuides);
    });

    // get a guide data
    app.get("/guide/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const allGuides = await guidesCollection.findOne(query);
      res.send(allGuides);
    });

    // get specific tour data
    app.get("/details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const tour = await toursCollection.findOne(query);
      res.json(tour);
    });

    // get all tours data
    app.get("/tours", async (req, res) => {
      const tours = await toursCollection.find().toArray();
      res.json(tours);
    });

    // add tour data
    app.post("/add-package", verifyToken, verifyAdmin, async (req, res) => {
      const packageData = req.body;
      const result = await toursCollection.insertOne(packageData);
      res.send(result);
    });

    // save bookings to the collection
    app.post("/booking", verifyToken, async (req, res) => {
      const bookingData = req.body;
      const result = await bookingsCollection.insertOne(bookingData);
      res.send(result);
    });

    // get all booking by user
    app.get("/bookings/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { "user.email": email };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    // get a booking by id
    app.get("/book/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.findOne(query);
      res.send(result);
    });

    // delete a booking
    app.delete("/booking/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    });

    // get guide assigned tours
    app.get(
      "/guides-asigned-tours/:email",
      verifyToken,
      verifyGuide,
      async (req, res) => {
        const email = req.params.email;
        const query = {
          "guide.email": email,
        };
        const allGuides = await bookingsCollection.find(query).toArray();
        res.send(allGuides);
      }
    );

    // update status when reject offer
    app.patch(
      "/bookings-reject/:id",
      verifyToken,
      verifyGuide,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const updatedDoc = {
          $set: {
            status: "rejected",
          },
        };
        const result = await bookingsCollection.updateOne(query, updatedDoc);
        res.send(result);
      }
    );

    // update status when guide reject
    app.patch(
      "/bookings-accept/:id",
      verifyToken,
      verifyGuide,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const updatedDoc = {
          $set: {
            status: "accepted",
          },
        };
        const result = await bookingsCollection.updateOne(query, updatedDoc);
        res.send(result);
      }
    );

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Elite Travels server is running");
});

app.listen(port, () => {
  console.log(`Elite Travels listening on port ${port}`);
});
