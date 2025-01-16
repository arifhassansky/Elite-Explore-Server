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
      const result = await usersCollection.insertOne(userData);
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

    // get specific booking by email
    app.get("/stories/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await storiesCollection.find(query).toArray();
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
      res.json(allGuides);
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
