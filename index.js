const express = require("express")
const app = express()
require('dotenv').config()
const cors = require("cors")
const port = process.env.PORT || 5000


// middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }));


// kalidashodekare14
// T40ZxIQCQPM4zZ0N



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { default: axios } = require("axios")
const uri = "mongodb+srv://kalidashodekare14:T40ZxIQCQPM4zZ0N@cluster0.1duwq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const AllProducts = client.db("EasyShop").collection("All_Product")
        const AllUsers = client.db("EasyShop").collection("All_Users")
        const paymentHistory = client.db("EasyShop").collection("Payment_Info")
        const tnxId = `TNX${Date.now()}`


        app.get('/all_product', async (req, res) => {
            const result = await AllProducts.find().toArray()
            res.send(result)
        })
        app.get('/prodcut_details/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await AllProducts.findOne(query)
            res.send(result)
        })

        app.get('/customar-profile/:email', async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const result = await AllUsers.findOne(query)
            res.send(result)
        })

        app.post('/all_product', async (req, res) => {
            const dataInfo = req.body
            const result = await AllProducts.insertOne(dataInfo)
            res.send(result)
        })

        app.post('/user-register', async (req, res) => {
            const user = req.body
            const userInfo = {
                email: user?.email,
                password: user?.password,
                mobile: user.mobile,
                createdAt: new Date()
            }
            const result = await AllUsers.insertOne(userInfo)
            res.send(result)
        })


        app.patch("/profile_image/:email", async (req, res) => {
            const email = req.params.email
            const update = req.body
            const filter = { email: email }
            const option = { upsert: true }
            const updateDoc = {
                $set: {
                    image: update.image
                }
            }
            const result = await AllUsers.updateOne(filter, updateDoc, option)
            res.send(result)
        })
        app.patch("/information_update/:email", async (req, res) => {
            const email = req.params.email
            const update = req.body
            const filter = { email: email }
            const option = { upsert: true }
            const updateDoc = {
                $set: {
                    name: update.name,
                    email: update.email,
                    mobile: update.mobile,
                    bio: update.bio
                }
            }
            const result = await AllUsers.updateOne(filter, updateDoc, option)
            res.send(result)
        })
        app.patch("/address_update/:email", async (req, res) => {
            const email = req.params.email
            const update = req.body
            const filter = { email: email }
            const option = { upsert: true }
            const updateDoc = {
                $set: {
                    country: update.country,
                    address: update.address,
                    postal_code: update.postal_code,
                    current_address: update.current_address
                }
            }
            const result = await AllUsers.updateOne(filter, updateDoc, option)
            res.send(result)
        })


        app.post("/payment-create", async (req, res) => {
            const paymentInfo = req.body
            const initateData = {
                store_id: "webwa66d6f4cb94fee",
                store_passwd: "webwa66d6f4cb94fee@ssl",
                total_amount: 5000,
                currency: "BDT",
                tran_id: tnxId,
                success_url: "http://localhost:5000/success-payment",
                fail_url: "http://localhost:5000/payment-fail",
                cancel_url: "http://localhost:5000/payment-cancel",
                cus_name: "Kalidash",
                cus_email: "kalidashodekare14@gmail.com",
                cus_add1: "Dhaka",
                cus_add2: "Dhaka",
                cus_city: "Dhaka",
                cus_state: "Dhaka",
                cus_postcode: "1000",
                cus_country: "Bangladesh",
                cus_phone: "01711111111",
                cus_fax: "01711111111",
                shipping_method: "NO",
                product_name: "biscut",
                product_category: "mamabiscut",
                product_profile: "general",
                multi_card_name: "mastercard,visacard,amexcard",
                value_a: "ref001_A&",
                value_b: "ref002_B&",
                value_c: "ref003_C&",
                value_d: "ref004_D",
            };

            const response = await axios({
                method: "POST",
                url: "https://sandbox.sslcommerz.com/gwprocess/v4/api.php",
                data: initateData,
                headers: {
                    "content-type": "application/x-www-form-urlencoded"
                }
            })

            const daveData = {
                customar_name: paymentInfo?.customar_name,
                customar_email: paymentInfo?.customar_email,
                amount: paymentInfo?.amount,
                current: paymentInfo.currency,
                transaction_id: tnxId,
                status: "Pending"
            }
            const save = await paymentHistory.insertOne(daveData)
            if (save) {
                res.send({
                    paymentUrl: response.data.GatewayPageURL
                })
            }
        })

        app.post("/success-payment", async (req, res) => {
            const successData = req.body
            if (successData.status !== "VALID") {
                throw new Error("Unauthorized payment, Invalid Payment")
            }
            console.log(successData.tran_id)
            const query = {
                transaction_id: successData.tran_id
            }
            console.log(successData.tran_id)
            const update = {
                $set: {
                    status: "Success"
                }
            }
            const result = await paymentHistory.updateOne(query, update)
            console.log('payment update', result)
            res.redirect(`http://localhost:5173/payment-success?tran_id=${successData.tran_id}`)
        })

        app.post("/payment-fail", async (req, res) => {
            res.redirect("http://localhost:5173/payment-fail")
        })

        app.post("/payment-cancel", async (req, res) => {
            res.redirect("http://localhost:5173/payment-cancel")
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send(`EasyStore Server Is Running`)
})

app.listen(port, () => {
    console.log(`EasyStore Server Is Running port ${port}`)
})