const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(
  "sk_test_51NHY8RAbpYs8wPJ2uSd0V1837cSHMarVoUW6fqlZPrRwvfIUmk5yj854Shueu6mXfg5gLTcblfPMauzYdQoyubew00QL1HN9Pd"
);
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9iyox0a.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  const userCollection = client.db("danceClassDB").collection("users");
  const classCollection = client.db("danceClassDB").collection("classes");
  const cartCollection = client.db("danceClassDB").collection("carts");
  const paymentCollection = client.db("danceClassDB").collection("payments");
  try {
    // await client.connect();

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send(token);
    });

    app.get("/carts", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.findOne(query);
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const storedClass = req.body;
      const result = await cartCollection.insertOne(storedClass);
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/classes", async (req, res) => {
      const DanceClass = req.body;
      const result = await classCollection.insertOne(DanceClass);
      res.send(result);
    });

    app.get("/classes", async (req, res) => {
      let query = {};
      if (req.query?.status) {
        query = { status: req.query.status };
      }
      if (req.query?.email) {
        query = { instructorEmail: req.query.email };
      }
      const result = await classCollection.find(query).sort({ enrolled: -1 }).toArray();
      res.send(result);
    });
    app.get("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.findOne(query);
      res.send(result);
    });
    app.patch("/classes/approved/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateClass = {
        $set: {
          status: "Approved",
        },
      };
      const result = await classCollection.updateOne(filter, updateClass);
      res.send(result);
    });
    app.patch("/classes/denied/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateClass = {
        $set: {
          status: "Denied",
        },
      };
      const result = await classCollection.updateOne(filter, updateClass);
      res.send(result);
    });

    app.patch("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const feedback = req.body.feedback;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateClass = {
        $set: {
          feedback: feedback,
        },
      };
      const result = await classCollection.updateOne(
        filter,
        updateClass,
        options
      );
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      let query = {};
      if (req.query?.role) {
        query = { role: req.query.role };
      }
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return;
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateUser = {
        $set: {
          role: "instructor",
        },
      };
      const result = await userCollection.updateOne(filter, updateUser);
      res.send(result);
    });
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateUser = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updateUser);
      res.send(result);
    });

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/payments", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await paymentCollection.find(query).sort({ date: -1 }).toArray();
      res.send(result);
    });
    
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      const { selectedClassId, classId } = payment;
      const seats = parseInt(payment.availableSeats);

      const updateResult = await classCollection.updateOne({ _id: new ObjectId(classId) }, {
        $inc: { enrolled: 1 },
        $set: { availableSeats: seats - 1 }
      },{ upsert: true } )

      const query = { _id: new ObjectId(selectedClassId) };
      const deleteResult = await cartCollection.deleteOne(query);

      res.send({insertResult, deleteResult, updateResult});
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("This is a summer dance academy");
});
app.listen(port, () => {
  console.log(`The summer dance server running on port: ${port}`);
});
