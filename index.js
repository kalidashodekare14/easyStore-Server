const express = require("express")
const app = express()
require('dotenv').config()
const jwt = require('jsonwebtoken');
const cors = require("cors")
const port = process.env.PORT || 5000
const http = require('http');
const { Server } = require("socket.io");
const { create } = require("domain");


// middleware
const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: ['http://localhost:5173', 'https://easystore-9fd6e.web.app'],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
})

app.use(cors({
    origin: ['http://localhost:5173', 'https://easystore-9fd6e.web.app'],
    methods: ["GET", "POST"],
    credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }));





const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { default: axios } = require("axios")
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1duwq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        const blogCollection = client.db("EasyShop").collection("Blogs")
        const notificationCollection = client.db("EasyShop").collection("notification")
        const tnxId = new ObjectId().toString();

        // jwt create
        app.post("/jwt", async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.JWT_TOKEN_KEY, { expiresIn: "1h" })
            res.send({ token })
        })



        // verify token
        const verifyToken = (req, res, next) => {
            // console.log("token checking", req.headers.authorization)
            if (!req.headers.authorization) {
                return res.status(401).send({ message: "forbidden access" })
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.JWT_TOKEN_KEY, (error, decoded) => {
                if (error) {
                    return res.status(401).send({ message: "forbidden access" })
                }
                req.decoded = decoded;
                next()
            })
        }

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email
            const query = { email: email }
            const adminFind = await AllUsers.findOne(query)
            const isAdmin = adminFind?.role === 'Admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'fobidden access' })
            }
            next()
        }

        // Admin Create
        app.get("/isAdmin/:email", verifyToken, async (req, res) => {
            const email = req.params.email
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "unauthorized access" })
            }
            const query = { email: email }
            const adminFind = await AllUsers.findOne(query)
            let admin = false
            if (adminFind && adminFind.role === "Admin") {
                admin = true
            }
            res.send({ admin })
        })

        app.get('/all_product', async (req, res) => {
            const result = await AllProducts.find().toArray()
            res.send(result)
        })

        // dashboard api

        app.get("/dashboard-all-product", verifyToken, verifyAdmin, async (req, res) => {
            const result = await AllProducts.find().toArray()
            res.send(result)
        })

        app.get("/dashboard-orders", verifyToken, verifyAdmin, async (req, res) => {
            const result = await paymentHistory.find().toArray()
            res.send(result)
        })

        app.get('/prodcut_details/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await AllProducts.findOne(query)
            res.send(result)
        })

        app.get('/customar-profile/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const result = await AllUsers.findOne(query)
            res.send(result)
        })

        app.get("/customar-payment-history/:email", verifyToken, async (req, res) => {
            const email = req.params.email
            const query = { customar_email: email }
            const result = await paymentHistory.find(query).toArray()
            res.send(result)
        })

        app.post('/all_product', async (req, res) => {
            const dataInfo = req.body
            const result = await AllProducts.insertOne(dataInfo)
            res.send(result)
        })

        app.post('/user-register', async (req, res) => {
            const user = req.body
            const query = { email: user.email }
            const exitstingUser = await AllUsers.findOne(query)
            if (exitstingUser) {
                return res.send({ message: 'user already exits', insertedId: null })
            }
            const userInfo = {
                name: user?.name,
                email: user?.email,
                image: user?.image,
                password: user?.password,
                mobile: user.mobile,
                createdAt: new Date()
            }
            const result = await AllUsers.insertOne(userInfo)

            const notification = {
                message: 'New User Registered',
                user: {
                    email: user.email
                },
                isRead: false,
                createdAt: new Date()
            }
            const notificationResult = await notificationCollection.insertOne(notification)
            io.emit('newUser', notification)
            res.send({ result, notificationResult })
        })

        app.get('/notification', verifyToken, verifyAdmin, async (req, res) => {
            const result = await notificationCollection.find({}).sort({ createdAt: -1 }).toArray()
            res.send(result)
        })

        // unread notification sum
        app.get('/notification/unread', verifyToken, verifyAdmin, async (req, res) => {
            const totalUnread = await notificationCollection.aggregate([
                { $match: { isRead: false } },
                {
                    $group: {
                        _id: null,
                        totalUnreadCount: { $sum: 1 },
                    }
                }
            ]).toArray()
            const unReadCount = totalUnread[0]?.totalUnreadCount || 0

            res.status(200).json({ totalUnreadNotificaton: unReadCount });
        })

        //  unread notification update
        app.patch('/notification-unread-update', async (req, res) => {
            const unreadCheck = { isRead: false }
            const updateData = {
                $set: {
                    isRead: true
                }
            }
            const result = await notificationCollection.updateMany(unreadCheck, updateData)
            res.send(result)
        })


        app.patch("/profile_image/:email", verifyToken, async (req, res) => {
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
        app.patch("/information_update/:email", verifyToken, async (req, res) => {
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
        app.patch("/address_update/:email", verifyToken, async (req, res) => {
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


        // payment method
        app.post("/payment-create", verifyToken, async (req, res) => {
            const paymentInfo = req.body

            console.log(paymentInfo)
            // Product Info
            const products = paymentInfo.prodcuts
            const product_name = products.map(product => product.prodcut_name).join(", ")
            const product_category = products.map(product => product.product_category).join(", ")

            // User Info
            const userInfo = paymentInfo.addressInfo
            // console.log(userInfo)

            const initateData = {
                store_id: "webwa66d6f4cb94fee",
                store_passwd: "webwa66d6f4cb94fee@ssl",
                total_amount: paymentInfo.amount,
                currency: paymentInfo.currency,
                tran_id: tnxId,
                success_url: "http://localhost:5000/success-payment",
                fail_url: "http://localhost:5000/payment-fail",
                cancel_url: "http://localhost:5000/payment-cancel",
                cus_name: paymentInfo.customar_name || "None",
                cus_email: paymentInfo.customar_email || "None",
                cus_add1: userInfo.current_address || "None",
                cus_add2: "Dhaka",
                cus_city: userInfo.address || "None",
                cus_state: "Dhaka",
                cus_postcode: userInfo.postal_code || "None",
                cus_country: userInfo.country || "None",
                cus_phone: userInfo.phone_number || "None",
                cus_fax: "01711111111",
                shipping_method: "NO",
                product_name: product_name,
                product_category: product_category,
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



            const saveData = {
                customar_name: paymentInfo?.customar_name,
                customar_email: paymentInfo?.customar_email,
                amount: paymentInfo?.amount,
                current: paymentInfo.currency,
                country: paymentInfo?.addressInfo?.country,
                transaction_id: tnxId,
                products,
                userInfo,
                status: "Pending",
                createdAt: new Date()
            }
            console.log('save data', saveData)
            const save = await paymentHistory.insertOne(saveData)
            if (save) {
                res.send({
                    paymentUrl: response.data.GatewayPageURL
                })
            }

            const notification = {
                message: 'New Order',
                name: paymentInfo.customar_name,
                user: {
                    email: paymentInfo.customar_email
                },
                transaction_id: tnxId,
                image: paymentInfo.image,
                isRead: false,
                createdAt: new Date()
            }
            await notificationCollection.insertOne(notification)
            io.emit('newOrder', notification)
        })

        app.post("/success-payment", async (req, res) => {
            const successData = req.body
            if (successData.status !== "VALID") {
                throw new Error("Unauthorized payment, Invalid Payment")
            }

            const query = {
                transaction_id: successData.tran_id
            }


            const update = {
                $set: {
                    status: "Success"
                }
            }

            try {
                const result = await paymentHistory.updateOne(query, update)
                console.log('payment update', result)
                res.redirect(`http://localhost:5173/payment-success?tran_id=${successData.tran_id}`)
            } catch (error) {
                console.log("Error updating payment status", error.message)
                res.status(500).send("payment update failed");
            }
        })

        // dashboard overview
        app.get("/dashboard-overview", verifyToken, verifyAdmin, async (req, res) => {
            try {
                const currentTime = new Date()
                const last24Hours = new Date(currentTime - 24 * 60 * 60 * 1000)
                const lastWeek = new Date(currentTime - 7 * 24 * 60 * 60 * 1000)
                const lastMonth = new Date(currentTime - 30 * 24 * 60 * 60 * 1000)
                const lastYear = new Date(currentTime - 365 * 24 * 60 * 60 * 1000)

                //  TOTAL AMOUNT START ===================================================

                const calculateTotal = async (collection, timeRange) => {
                    const count = await collection.countDocuments({ createdAt: { $gte: timeRange } })
                    const totalAmout = await collection.aggregate([
                        { $match: { createdAt: { $gte: timeRange } } },
                        { $group: { _id: null, total: { $sum: "$amount" } } }
                    ]).toArray()
                    return {
                        count,
                        totalAmount: totalAmout.length > 0 ? totalAmout[0].total : 0
                    }
                }

                const last24HourseRevenue = await calculateTotal(paymentHistory, last24Hours)
                const last24WeekRevenue = await calculateTotal(paymentHistory, lastWeek)
                const last24MonthRevenue = await calculateTotal(paymentHistory, lastMonth)
                const last24YearRevenue = await calculateTotal(paymentHistory, lastYear)

                //  TOTAL AMOUNT END ===========================================================

                // TOTAL CUSTOMAR START ========================================================

                const last24HourseCustomar = await AllUsers.countDocuments({ createdAt: { $gte: last24Hours } })
                const lastWeekCustomar = await AllUsers.countDocuments({ createdAt: { $gte: lastWeek } })
                const lastMonthCustomar = await AllUsers.countDocuments({ createdAt: { $gte: lastMonth } })
                const lastYearCustomar = await AllUsers.countDocuments({ createdAt: { $gte: lastYear } })

                // TOTAL CUSTOMAR END ==========================================================

                // TOTAL ORDER START ========================================================

                const last24HoursOrder = await paymentHistory.countDocuments({ createdAt: { $gte: last24Hours } })
                const lastWeekOrder = await paymentHistory.countDocuments({ createdAt: { $gte: lastWeek } })
                const lastMonthOrder = await paymentHistory.countDocuments({ createdAt: { $gte: lastMonth } })
                const lastYearOrder = await paymentHistory.countDocuments({ createdAt: { $gte: lastYear } })

                // TOTAL ORDER END ========================================================


                // TOTAL ORDER START ========================================================

                const last24HoursProducts = await AllProducts.countDocuments({ createdAt: { $gte: last24Hours } })
                const lastWeekProducts = await AllProducts.countDocuments({ createdAt: { $gte: lastWeek } })
                const lastMonthProducts = await AllProducts.countDocuments({ createdAt: { $gte: lastMonth } })
                const lastYearProducts = await AllProducts.countDocuments({ createdAt: { $gte: lastYear } })

                // TOTAL ORDER END ========================================================

                res.status(200).json({
                    totalRevenue: {
                        last24Hours: last24HourseRevenue.totalAmount,
                        lasWeeks: last24WeekRevenue.totalAmount,
                        lastMonth: last24MonthRevenue.totalAmount,
                        lastYear: last24YearRevenue.totalAmount
                    },
                    totalCustomar: {
                        last24Hours: last24HourseCustomar,
                        lastWeek: lastWeekCustomar,
                        lastMonth: lastMonthCustomar,
                        lastYear: lastYearCustomar
                    },
                    totalOrder: {
                        last24Hours: last24HoursOrder,
                        lastWeek: lastWeekProducts,
                        lastMonth: lastMonthOrder,
                        lastYear: lastYearOrder
                    },
                    totalProducts: {
                        last24Hours: last24HoursProducts,
                        lastWeek: lastWeekOrder,
                        lastMonth: lastMonthProducts,
                        lastYear: lastYearProducts
                    },


                })


            } catch (error) {
                res.status(500).json({ message: error.message })
            }
        })

        app.get('/monthly-data', verifyToken, verifyAdmin, async (req, res) => {

            try {
                const monthlyRevenue = await paymentHistory.aggregate([
                    {
                        $group: {
                            _id: { month: { $month: '$createdAt' } },
                            totalRevenue: { $sum: '$amount' }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]).toArray()

                const monthlyCustomar = await AllUsers.aggregate([
                    {
                        $group: {
                            _id: { month: { $month: '$createdAt' } },
                            totalCustomar: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]).toArray()

                const monthlyOrder = await paymentHistory.aggregate([
                    {
                        $group: {
                            _id: { month: { $month: '$createdAt' } },
                            totalOrder: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]).toArray()



                const monthlyProducts = await AllUsers.aggregate([
                    {
                        $group: {
                            _id: { month: { $month: '$createdAt' } },
                            totalProduct: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]).toArray()


                // Monthly and Country Sales Data
                const monthlyCountrySales = await paymentHistory.aggregate([
                    {
                        $group: {
                            _id: {
                                month: { $month: '$createdAt' },
                                country: '$country'
                            },
                            totalSales: { $sum: '$amount' },
                            totalOrders: { $sum: 1 }
                        }
                    },
                    {
                        $sort: { "_id.month": 1 }
                    }
                ]).toArray()

                res.send({
                    revenue: monthlyRevenue,
                    totalCustomar: monthlyCustomar,
                    allProduct: monthlyProducts,
                    totalOrder: monthlyOrder,
                    countrySales: monthlyCountrySales
                })

            } catch (error) {
                console.log(error.message)
            }
        })


        // dashboard blogs post and get
        app.post('/blogs-post', verifyToken, verifyAdmin, async (req, res) => {
            const contentInfo = req.body
            const contentData = {
                blogTitle: contentInfo.blogTitle,
                blogThumbnail: contentInfo.blogThumbnail,
                content: contentInfo.content,
                createdAt: new Date()
            }
            const result = await blogCollection.insertOne(contentData)
            res.send(result)
        })

        app.get('/blogs', async (req, res) => {
            const result = await blogCollection.find().toArray()
            res.send(result)
        })

        app.get('/blog-details/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await blogCollection.findOne(query)
            res.send(result)
        })


        app.post("/payment-fail", async (req, res) => {
            res.redirect("http://localhost:5173/payment-fail")
        })

        app.post("/payment-cancel", async (req, res) => {
            res.redirect("http://localhost:5173/payment-cancel")
        })


        app.delete("/all-product/:id", async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await AllProducts.deleteOne(query)
            res.send(result)
        })


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


io.on('connection', (socket) => {
    console.log('New client Connected');

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    })
})


app.get('/', (req, res) => {
    res.send(`EasyStore Server Is Running`)
})

server.listen(port, () => {
    console.log(`EasyStore Server Is Running port ${port}`);
});
