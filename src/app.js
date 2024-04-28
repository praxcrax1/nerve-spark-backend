const { MongoClient , ObjectId } = require('mongodb');
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { faker } = require("@faker-js/faker");


const app = express();
app.use(cors());
const PORT = 3001;




app.use(bodyParser.json());

let db;

const MongoURI = `mongodb+srv://praxcrax:PtWGm7vk9oePUXtv@cluster0.mmje8uv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const DATABASE_NAME = "Nervespark";

MongoClient.connect(MongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  })
  .then((client) => {
    console.log("Connected to MongoDB");
    db = client.db(DATABASE_NAME);
    
  })
  
  .catch((err) => console.error("Error connecting to MongoDB", err));


//SIGNUP APIs


app.post("/api/signup/user", async (req, res) => {
  const { email, password } = req.body;

  try {
    const existingUser = await db
      .collection("user")
      .findOne({ user_email: email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      user_email: email,
      user_id: new ObjectId().toString(), 
      password_hash: hashedPassword,
      vehicle_info: [],
    };

    await db.collection("user").insertOne(newUser);

    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Error during user signup:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/signup/dealership", async (req, res) => {
  const { email, password } = req.body;

  try {
    const existingDealership = await db
      .collection("dealership")
      .findOne({ dealership_email: email });
    if (existingDealership) {
      return res.status(400).json({ message: "Dealership already exists" });
    }


    const hashedPassword = await bcrypt.hash(password, 10);


    const newDealership = {
      dealership_email: email,
      dealership_id: new ObjectId().toString(),
      password_hash: hashedPassword,
      cars: [],
      deals: [],
      sold_vehicles: [],
    };

    await db.collection("dealership").insertOne(newDealership);

    res.status(201).json({ message: "Dealership created successfully" });
  } catch (error) {
    console.error("Error during dealership signup:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//LOGIN APIs


app.post("/api/login/user", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await db.collection("user").findOne({ user_email: email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Incorrect password" });
    }
    const token = jwt.sign({ userId: user.user_id }, "your_secret_key", {
      expiresIn: "1h",
    });
    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("Error during user login:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.post("/api/login/dealership", async (req, res) => {
  const { email, password } = req.body;
  try {
    const dealership = await db.collection("dealership").findOne({ dealership_email: email });
    if (!dealership) {
      return res.status(404).json({ message: "dealership not found" });
    }
    const passwordMatch = await bcrypt.compare(password, dealership.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Incorrect password" });
    }
    const token = jwt.sign({ dealershipId: dealership.dealership_id }, "your_secret_key", {
      expiresIn: "1h",
    });
    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("Error during dealership login:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// View all cars
app.get("/api/cars", async (req, res) => {
  try {
    const cars = await db.collection("cars").find({}).toArray();
    res.json(cars);
  } catch (error) {
    console.error("Error fetching cars:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


// Endpoint to retrieve dealerships for a specific car

app.get('/api/dealerships/:carId', async (req, res) => {
  try {
    const carId = req.params.carId;
    const dealerships = await db.collection('dealership').distinct('dealership_email', { cars: carId });

    if (dealerships.length === 0) {
      return res.json(dealerships)
    }

    res.json({ dealerships });
    console.log(res)
  } catch (error) {
    console.error('Error fetching dealerships:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add new vehicle to the list of owned/sold vehicles

app.post("/api/vehicles", async (req, res) => {
  const { userId, dealershipId, carId, vehicleInfo } = req.body;
  const collectionName = userId ? "user" : "dealership";
  const objectId = userId ? userId : dealershipId;

  try {
    // Validate input data

    // Check if the user/dealership exists
    const existingEntity = await db.collection(collectionName).findOne({ _id: ObjectId(objectId) });
    if (!existingEntity) {
      return res.status(404).json({ message: "User or dealership not found" });
    }

    // Add the vehicle to the list of owned/sold vehicles
    const result = await db.collection(collectionName).updateOne(
      { _id: ObjectId(objectId) },
      { $push: { vehicles: { car_id: carId, vehicle_info: vehicleInfo } } }
    );

    if (result.modifiedCount === 0) {
      return res.status(500).json({ message: "Failed to add vehicle" });
    }

    res.status(201).json({ message: "Vehicle added successfully" });
  } catch (error) {
    console.error("Error adding vehicle:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//Password Change 

app.post("/api/change-password", async (req, res) => {
  const { email, oldPassword, newPassword } = req.body;

  try {
    const user = await db.collection("user").findOne({ user_email: email });
    if (!user) {
      try {
         const dealership = await db
           .collection("dealership")
           .findOne({ dealership_email: email });

        const passwordMatch = await bcrypt.compare(
          oldPassword,
          dealership.password_hash
        );
        if (!passwordMatch) {
          return res.status(401).json({ message: "Incorrect old password" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db
          .collection("dealership")
          .updateOne(
            { dealership_email: email },
            { $set: { password_hash: hashedPassword } }
          );

        res.status(200).json({ message: "Password changed successfully" });
      } catch (error) {
        console.error("Error during password change:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }

    const passwordMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Incorrect old password" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db
      .collection("user")
      .updateOne(
        { user_email: email },
        { $set: { password_hash: hashedPassword } }
      );

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error during password change:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


//Buying a car
  
app.post("/api/buy-car/:email/:dealership", async (req, res) => {
  const email = req.params.email;
  const dealershipId = req.params.dealership; // Assuming dealershipId is used for identification

  const { carId } = req.body;

  try {
    const user = await db.collection("user").findOne({ user_email: email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const car = await db.collection("cars").findOne({ car_id: carId });
    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    const dealership = await db
      .collection("dealership")
      .findOne({ dealership_email: dealershipId });
    if (!dealership) {
      return res.status(404).json({ message: "Dealership not found" });
    }

    await db.collection("sold_vehicles").insertOne({
      car_id: carId,
      type: car.type,
      name: car.name,
      model: car.model,
      vehicle_info: car.car_info,
    });

    await db.collection("cars").deleteOne({ car_id: carId });

    await db
      .collection("user")
      .updateOne({ user_email: email }, { $push: { vehicle_info: carId } });

    await db
      .collection("dealership")
      .updateOne({ dealership_email: dealershipId }, { $pull: { cars: carId } });
    await db
      .collection("dealership")
      .updateOne(
        { dealership_email: dealershipId },
        { $push: { sold_vehicles: carId } }
      );

    res.status(200).json({ message: "Car bought successfully" });
  } catch (error) {
    console.error("Error during car purchase:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//Get Dealership's Inventory 

app.get("/api/dealership/inventory/:email", async (req, res) => {
  const email = req.params.email;

  try {
    const dealership = await db
      .collection("dealership")
      .findOne({ dealership_email: email });
    if (!dealership) {
      return res.status(404).json({ message: "Dealership not found" });
    }

    const inventory = await db
      .collection("cars")
      .find({ car_id: { $in: dealership.cars } })
      .toArray();

     if (inventory.length === 0) {
       return res.status(200).json({ message: "No cars in inventory" });
     }  

    res.status(200).json({ cars: inventory });
  } catch (error) {
    console.error("Error fetching dealership inventory:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.get("/api/dealerships/inventory", async (req, res) => {
  try {
    // Fetch all dealerships
    const allDealerships = await db.collection("dealership").find().toArray();

    // Initialize an empty array to store all car details
    let allCars = [];

    // Loop through each dealership
    for (const dealership of allDealerships) {
      // Check if the dealership has cars
      if (dealership.cars && Array.isArray(dealership.cars)) {
        // Fetch car details for each car ID in the dealership
        const inventory = await db
          .collection("cars")
          .find({ car_id: { $in: dealership.cars } })
          .toArray();

        // Concatenate the car details to the allCars array
        allCars = allCars.concat(inventory);
      }
    }

    // Send the combined car details as response
    res.json(allCars);
  } catch (error) {
    console.error("Error fetching dealership inventory:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


// Dealership sold vehicles

app.get("/api/dealership/sold-vehicles/:email", async (req, res) => {
  const email = req.params.email;
  try {
    // Find dealership by email
    const dealership = await db
      .collection("dealership")
      .findOne({ dealership_email: email });
    if (!dealership) {
      return res.status(404).json({ message: "Dealership not found" });
    }

    // Fetch sold vehicles from dealership
    const soldVehicles = dealership.sold_vehicles || [];

    // Fetch sold cars from sold_vehicles table
    const soldCars = await Promise.all(
      soldVehicles.map(async (carId) => {
        const soldCar = await db
          .collection("sold_vehicles")
          .findOne({ car_id: carId });

        // Check if the car is bought by a user
        const usersWithCar = await db
          .collection("user")
          .find({ vehicle_info: carId })
          .toArray();

        // If bought by a user, get the user's email
        const soldTo =
          usersWithCar.length > 0 ? usersWithCar[0].user_email : "Unknown";

        // Return the car details and the email of the user who bought it
        return {
          car_details: soldCar,
          sold_to: soldTo,
        };
      })
    );

    res.status(200).json(soldCars);
  } catch (error) {
    console.error("Error fetching sold vehicles:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});




//Acquire Cars

app.post("/api/dealership/acquire/:email", async (req, res) => {
  const email = req.params.email;
  const { carId } = req.body;

  try {
    // Check if the dealership exists
    const dealership = await db
      .collection("dealership")
      .findOne({ dealership_email: email });
    if (!dealership) {
      return res.status(404).json({ message: "Dealership not found" });
    }

    // Add the carId to the cars array of the dealership
    await db
      .collection("dealership")
      .updateOne({ _id: dealership._id }, { $push: { cars: carId } });

    res.status(200).json({ message: "Car acquired successfully" });
  } catch (error) {
    console.error("Error acquiring car:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//Return User Owned Cars

app.get("/api/user/cars/:email", async (req, res) => {
  const  email  = req.params.email;

  try {
    const user = await db.collection("user").findOne({ user_email: email });

    if (!user) {
      return res.status(404).json({ message: "User Not Found" });
    }

    const carIds = user.vehicle_info;

    const cars = await db
      .collection("sold_vehicles")
      .find({ car_id: { $in: carIds } })
      .toArray();

    res.status(200).json({ cars });
  } catch (error) {
    console.error("Error fetching user cars:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
  
