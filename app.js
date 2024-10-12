const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Razorpay = require("razorpay");
require('dotenv').config();
const mockData = require('./mockData');
const nodemailer = require('nodemailer');
const path = require('path')
// const twilio = require('twilio');
const crypto = require('crypto');

const app = express();
// Define allowed origins
const allowedOrigins = [
  'https://tamannacollection.gurulogicsolution.com',
  'http://localhost:3001' // Include if still testing locally
];

// CORS Configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Handle Preflight Requests Globally
app.options('*', cors());
app.use(express.static("Public"))

app.use(bodyParser.json());
app.use(express.json());


// // const sharp = require('sharp');





const sendEmail = async (product, amount,userDetails,order_id,payment_id) => {
  let transporter = nodemailer.createTransport({
    service: 'gmail', // Or any other service you are using
    auth: {
      user: process.env.EMAIL_USER, // Your email
      pass: process.env.EMAIL_PASSWORD // Your password
    }
  });

  let mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.OWNER_EMAIL, // Owner's email
    subject: `New Payment for Product`,
    text: `A new payment has been made for ${product.name}. Amount: ₹${amount / 100}. \n Customer Name: ${userDetails.name} \n Customer Email: ${userDetails.email} \n Customer Contact: ${userDetails.phone} \n Customer Adress: ${userDetails.address}\n\n\n Order_id = ${order_id}\n Payment ID = ${payment_id}`,
    html: `
      <p>A new payment has been made for <strong>${product.name}</strong>. Amount: ₹${amount / 100}.</p>
      <p><strong>Customer Details:</strong></p>
      <ul>
        <li><strong>Name:</strong> ${userDetails.name}</li>
        <li><strong>Email:</strong> ${userDetails.email}</li>
        <li><strong>Contact:</strong> ${userDetails.phone}</li>
        <li><strong>Address:</strong> ${userDetails.address}</li>
      </ul>
      <p><strong>Order ID:</strong> ${order_id}</p>
      <p><strong>Payment ID:</strong> ${payment_id}</p>
      <p>See the image below:</p>
      <img src="cid:unique@nodemailer" alt="Product Image"/>
    `,
    attachments: [
      {
        filename: `${product.img[0]}`, // Name of the image file (you can change it as needed)
        path: path.join(__dirname, 'Public','assets','products', `${product.img[0]}.jpg`), // Path to the image in your backend's static folder
        cid: 'unique@nodemailer' // Ensure that each image has a unique cid for inline images (optional, used for inline images)
      }
    ]
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
};

// const client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const accountSid = 'AC5a713329c95ad51b5218a03450d3bf17';
const authToken = '446437623d1c508eb34f62600aa8c14e';
const client = require('twilio')(accountSid, authToken);

 




// const productImageUrl = 'http://localhost:3000/assets/products/img1.1.jpg';
    


let amount;
let product;
let userDetails;
app.post('/api/buyProduct',async(req,res)=>{
    try{
            const rzp = new Razorpay({
            key_id:process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        })
        product = mockData.shopData[req.body.product.id -1]
         amount = mockData.shopData[req.body.product.id -1].price * 100;
         userDetails = req.body.userDetails
        rzp.orders.create({amount,currency:"INR"},async (err,order)=>{
            if(err){
                throw new Error(JSON.stringify(err))
            }
            return res.status(200).json({order,key_id:rzp.key_id})
        })
    } catch(err){
        res.status(400).json("Something Went Wrong!!")
    }
})

const sendWhatsAppMessage = async (product, amount) => {
    client.messages.create({
      body: `A new payment has been made for ${product.name}. Product Id: ${product.id}. Amount: ₹${amount / 100}. Customer Name: ${userDetails.name}. Customer Email: ${userDetails.email}. Customer Contact: ${userDetails.phone}. Customer Address: ${userDetails.address}`,
      // mediaUrl: [imgurl],
      from: 'whatsapp:+14155238886', // Twilio's sandbox WhatsApp number
      to: 'whatsapp:+918946914346' // Owner's WhatsApp number
    }).then(message => console.log(message.sid))
      .catch(err => console.log(err));
 };

app.post("/api/paymentVerification", async (req, res) => {
    const { order_id,payment_id,signature } = req.body;
  console.log("from payment verification block",order_id,payment_id,signature)

  
    const shasum = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    shasum.update(order_id + "|" + payment_id);
    const digest = shasum.digest("hex");
  
    if (digest === signature) {
      // Payment is successful
      // Send Email and WhatsApp here
      console.log("from digest", product,amount, userDetails,order_id,payment_id)
      await sendEmail(product, amount,userDetails, order_id,payment_id);
      // await sendWhatsAppMessage(product, amount);
  
      res.status(200).json({ success: true, message: "Payment verified" });
    } else {
      res.status(400).json({ success: false, message: "Invalid signature" });
    }
  });

app.post("/api/updateFailureTransactionStatus", async(req,res)=>{
    try {
        const {payment_id,order_id}= req.body;
        res.status(200).json({message:"Transaction Successfull",success:true})
          }catch(err){
            res.status(500).json({message:"Transaction Failed!",success:false})
          }
})
// Global Error Handler (Ensure this is after all routes)
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

app.listen(process.env.PORT ,()=>{
  console.log(`Server is running at port ${process.env.PORT}`);
  console.log("new changes updated 02")
})