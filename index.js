const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectId } = require('mongodb');
const app = express();
const port = 3000;

require('dotenv').config()


var admin = require("firebase-admin");
const stripe = require('stripe')(`${process.env.STRIPE_SECRET_KEY}`);

const decoded = Buffer.from(process.env.FIREBASE_ADMIN, 'base64').toString(
	'utf8'
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});










app.use(cors());

app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@shazad.pcs99yl.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// 🔹 Connect DB once
async function connectDB() {
  try {
    await client.connect();



const myDB = client.db("ticketsDB");
const ticketColl = myDB.collection("ticketMenu");
const bookingColl = myDB.collection("bookingData");
const vendorticketmakercoll = myDB.collection("vendorTicketMaker");

app.get('/tickets', async (req, res) => {
  try {
    const now = new Date();

 
    const tickets = await vendorticketmakercoll.find({
      status: "admin-approve",
      departure: { $exists: true, $ne: "" }
    }).toArray();

   
    const ticketsWithDate = tickets.map(ticket => {
      const depDate = new Date(ticket.departure); // JS handles AM/PM automatically
      return { ...ticket, departureDate: depDate };
    });

 
    const futureTickets = ticketsWithDate.filter(t => t.departureDate >= now);

    
    futureTickets.sort((a, b) => a.departureDate - b.departureDate);

    res.json(futureTickets);
  } catch (err) {
    console.error("TICKETS ERROR 👉", err);
    res.status(500).json({ error: "Server error", message: err.message });
  }
});


// all ticvkets
app.get('/ticket-all', async (req, res) => {
  try {
    const now = new Date();

   
    const tickets = await vendorticketmakercoll.find({
      departure: { $exists: true, $ne: "" }
    }).toArray();

 
    const ticketsWithDate = tickets.map(ticket => {
      const depDate = new Date(ticket.departure); // 
      return { ...ticket, departureDate: isNaN(depDate) ? null : depDate };
    });

  
    const futureTickets = ticketsWithDate.filter(
      t => t.status === "admin-approve" && t.departureDate && t.departureDate >= now
    );

  
    futureTickets.sort((a, b) => a.departureDate - b.departureDate);

    res.json(futureTickets);
  } catch (err) {
    console.error("TICKET-ALL ERROR 👉", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});













// vendor
app.get("/user/role/:email", async (req, res) => {
  const email = req.params.email;

  const user = await ticketColl.findOne({ email });

  res.send({ role: user?.role || "user" });
});





// details
app.get('/detail/:id', async (req, res) => {
  const id = req.params.id;

  const ticket = await vendorticketmakercoll.findOne({
    _id: new ObjectId(id)
  });

  res.send(ticket);
});



// bookingdata



app.post('/bookingdata',  async (req, res) => {
  const bookingData = req.body;
  const result = await bookingColl.insertOne(bookingData);
  res.json(result);
});



// dastbor


app.get('/dashboard/:email', async (req, res) => {
  const email = req.params.email;

  const dashboardData = await bookingColl
    .find({ email })
    .toArray();

  res.send(dashboardData);
});



// vendor pending data


app.get('/all-pendingdata', async (req, res) => {
  const pendingData = await bookingColl
    .find({ status: "pending" })  
    .toArray();

  res.send(pendingData);
});




// VENDOR APPROVE DATA
app.patch('/update-status/:id', async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      status: "approve"
    }
  };
  const result = await bookingColl.updateOne(filter, updateDoc);
  res.send(result);
});




app.get('/ticket-latest', async (req, res) => {
  try {
    const now = new Date();

  
    const tickets = await vendorticketmakercoll.find({
      status: "admin-approve",
      departure: { $exists: true, $ne: "" }
    }).toArray();

 
    const ticketsWithDate = tickets.map(ticket => {
      const depDate = new Date(ticket.departure); // JS parses AM/PM automatically
      return { ...ticket, departureDate: isNaN(depDate) ? null : depDate };
    });


    const futureTickets = ticketsWithDate.filter(
      t => t.departureDate && t.departureDate >= now
    );


    futureTickets.sort((a, b) => b.departureDate - a.departureDate);


    const latest7Tickets = futureTickets.slice(0, 7);

    res.json(latest7Tickets);
  } catch (err) {
    console.error("Error fetching latest tickets:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});




// vendorticketmakercoll




app.post('/vendorticketmaker', async (req, res) => {
  const vendorTicketData = req.body;
  const result = await vendorticketmakercoll.insertOne(vendorTicketData);
  res.json(result);
});


// amdim parove





app.get('/vendor-pendingdata', async (req, res) => {
  const pendingData = await vendorticketmakercoll
    .find({ status: "vendor-pending" })  
    .toArray();

  res.send(pendingData);
});



// admin vendor data  parove



app.patch('/update-admin/:id', async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      status: "admin-approve"
    }
  };
  const result = await vendorticketmakercoll.updateOne(filter, updateDoc);
  res.send(result);
});



app.delete('/delete-admin/:id', async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      status: "admin-reject"
    }
  };
  const result = await vendorticketmakercoll.updateOne(filter, updateDoc);
  res.send(result);
});


// stripe api 
app.post('/create-cheakout-session', async (req, res) => {
  try {
    const paymentinfo = req.body;
    const amount = Number(paymentinfo.price) * 100;

    if (!amount) {
      return res.status(400).send({ error: 'Invalid amount' });
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amount,
            product_data: {
              name: "sda",
            },
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      metadata: {
        email: paymentinfo.email,
        
       title: paymentinfo.title,
       status: paymentinfo.status,
       price: paymentinfo.price,
       Image: paymentinfo.Image,
       quantity: paymentinfo.quantity
      },
      success_url: 'https://governmentticket.pages.dev/success.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://localhost:5173/cancel.html',
    });

    res.send({ url: session.url ,paymentinfo});
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: error.message });
  }
});



// stripe succes api


app.get('/success', async (req, res) => {
  const sessionId = req.query.session_id;

  if (!sessionId) {
    return res.status(400).send({ error: 'Missing session ID' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      res.send({ sessionId ,
        metadata: session.metadata
      });
    } else {
      res.send({ paid: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: error.message });
  }
});







    // console.log("✅ MongoDB connected successfully");
  } catch (err) {
    // console.error("❌ MongoDB connection failed", err);
  }
}
connectDB();


app.get('/', (req, res) => {
  res.send('Server & MongoDB is running 🚀');
});


app.get('/test-db', async (req, res) => {
  try {
    const dbs = await client.db().admin().listDatabases();
    res.json(dbs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Start server
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});




// assignment11
// ylAreRXUjrdZSeqt