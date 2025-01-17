require("dotenv").config();
const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;
const cors = require("cors");

// middlewares
app.use(cors());
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

    // get all user
    app.get("/users", async (req, res) => {
      const { search, role } = req.query;
      const query = {};

      if (search) {
        query.name = { $regex: search, $options: "i" };
      }

      if (role) {
        query.role = role;
      }
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    // get user data by email
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    // update user profile
    app.patch("/update-profile/:id", async (req, res) => {
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
    app.get("/stories/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await storiesCollection.find(query).toArray();
      res.send(result);
    });

    // get story by id
    app.get("/story/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await storiesCollection.findOne(query);
      res.send(result);
    });

    // delete a story
    app.delete("/stories/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await storiesCollection.deleteOne(query);
      res.send(result);
    });

    // post a story
    app.post("/add-story", async (req, res) => {
      const storyData = req.body;
      const result = await storiesCollection.insertOne(storyData);
      res.send(result);
    });

    // Update story photos (Add new photos and remove specific ones)

    app.put("/update-story/:id", async (req, res) => {
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
    app.post("/add-package", async (req, res) => {
      const packageData = req.body;
      const result = await toursCollection.insertOne(packageData);
      res.send(result);
    });

    // save bookings to the collection
    app.post("/booking", async (req, res) => {
      const bookingData = req.body;
      const result = await bookingsCollection.insertOne(bookingData);
      res.send(result);
    });

    // get specific booking by email
    app.get("/bookings/:email", async (req, res) => {
      const email = req.params.email;
      const query = { "user.email": email };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    // get guide assigned tours
    app.get("/guides-asigned-tours/:email", async (req, res) => {
      const email = req.params.email;
      const query = {
        "guide.email": email,
      };
      const allGuides = await bookingsCollection.find(query).toArray();
      res.send(allGuides);
    });

    // update status when reject reject
    app.patch("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const updatedDoc = {
        $set: {
          status: "acepted",
        },
      };
      const result = await bookingsCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // update status when guide reject
    app.patch("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const updatedDoc = {
        $set: {
          status: "rejected",
        },
      };
      const result = await bookingsCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

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
