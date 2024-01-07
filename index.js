const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
const multer = require("multer");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const path = require("path");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { log } = require("console");
const secretKey = crypto.randomBytes(32).toString("hex");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, secretKey);
    req.S_id = decoded.S_id;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// Use multer with the updated storage configuration
const upload = multer({ storage: storage });

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@back-prac-2-admin.sldkkq5.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let EventCollection;
let UserCollection;

client.connect().then(() => {
  console.log("Connected to MongoDB");
  const db = client.db("GubConnect");
  EventCollection = db.collection("EventCollection");
  UserCollection = db.collection("User");
});

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
async function run() {
  try {
    await client.connect();
    const db = client.db("GubConnect");

    const UserCollection = db.collection("User");
    const AdminCollection = db.collection("Admin");
    const TeacherCollection = db.collection("Teacher");
    const JobPostCollection = db.collection("JobPost");
    const EventCollection = db.collection("Event");
    app.post(
      "/addUser",
      upload.fields([
        { name: "ProfileImage", maxCount: 1 },
        { name: "StudentIdImage", maxCount: 1 },
      ]),
      async (req, res) => {
        try {
          const newStudent = req.body;

          // Check if both images are present in the request
          if (
            !req.files ||
            !req.files["ProfileImage"] ||
            !req.files["StudentIdImage"]
          ) {
            return res.status(400).json({
              error: "Both ProfileImage and StudentImage are required",
            });
          }

          const profileImagePath = req.files["ProfileImage"][0].path;
          const studentIdImagePath = req.files["StudentIdImage"][0].path;

          const student = {
            ...newStudent,
            ProfilePicture: profileImagePath, // Assuming ProfilePicture is the field to store the profile picture path
            Image: studentIdImagePath,
          };

          const result = await UserCollection.insertOne(student);
          res.json(result);
        } catch (error) {
          console.error("Error:", error);
          res.status(500).json({
            error: "Internal Server Error",
            details: error.message,
          });
        }
      }
    );

    app.post("/userLogin", async (req, res) => {
      try {
        const { S_id, Password } = req.body;
        console.log(S_id, Password);

        // Find the user by S_id
        const user = await UserCollection.findOne({ S_id });

        if (user) {
          // Compare the hashed password
          // const passwordMatch = await (Password, user.Password);

          // if (passwordMatch) {
          if (Password === user.Password) {
            // Check the status of the user
            if (user.Status === "Approved") {
              // Generate JWT token
              const token = jwt.sign({ S_id }, secretKey, { expiresIn: "1h" });
              console.log(token);

              // Send success response with token
              res.json({ success: true, token });
            } else if (user.Status === "Pending") {
              res.json({ success: false, message: "Approval is pending" });
            } else {
              res.json({ success: false, message: "User status is invalid" });
            }
          } else {
            res.json({ success: false, message: "Invalid credentials" });
          }
        } else {
          res.json({ success: false, message: "Invalid credentials" });
        }
      } catch (error) {
        console.error("Error:", error);
        res
          .status(500)
          .json({ error: "Internal Server Error", details: error.message });
      }
    });
    app.post("/protected-route", requireAuth, (req, res) => {
      const S_id = req.S_id;
      res.json({
        message: `Protected route accessed by user with S_id: ${S_id}`,
      });
    });

    app.post("/addEvent", upload.array("Images"), async (req, res) => {
      try {
        const newEvent = req.body;

        // Check if req.files is not null and has length greater than 0
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ error: "Images are required" });
        }

        const imagePaths = req.files.map((file) => file.path);
        const event = {
          ...newEvent,
          Images: imagePaths,
        };

        const result = await EventCollection.insertOne(event);
        res.json(result);
      } catch (error) {
        console.error("Error:", error);

        res
          .status(500)
          .json({ error: "Internal Server Error", details: error.message });
      }
    });
    app.get("/events", async (req, res) => {
      try {
        const events = await EventCollection.find({}).toArray();
        res.json(events);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Create user
    // app.post("/userLogin", async (req, res) => {
    //   try {
    //     const { S_id, Password } = req.body;

    //     // Find the user by S_id and Password
    //     const user = await UserCollection.findOne({ S_id, Password });

    //     if (user) {
    //       // Check the status of the user
    //       if (user.Status === "Approved") {
    //         // Generate JWT token
    //         const token = jwt.sign({ S_id }, secretKey, { expiresIn: "1h" });

    //         // Send success response with token
    //         res.json({ success: true, token });
    //       } else if (user.Status === "Pending") {
    //         res.json({ success: false, message: "Approval is pending" });
    //       } else {
    //         res.json({ success: false, message: "User status is invalid" });
    //       }
    //     } else {
    //       res.json({ success: false, message: "Invalid credentials" });
    //     }
    //   } catch (error) {
    //     console.error("Error:", error);
    //     res
    //       .status(500)
    //       .json({ error: "Internal Server Error", details: error.message });
    //   }
    // });

    app.post("/adminLogin", async (req, res) => {
      try {
        const { email, password } = req.body;

        const admin = await AdminCollection.findOne({
          email: { $regex: new RegExp(email, "i") },
        });

        if (admin && (await bcrypt.compare(password, admin.password))) {
          res.json({ success: true });
        } else {
          res.json({ success: false });
        }
      } catch (error) {
        console.error("Error:", error);
        res
          .status(500)
          .json({ error: "Internal Server Error", details: error.message });
      }
    });

    // Add new admin
    app.post("/addAdmin", async (req, res) => {
      try {
        const { name, email, password } = req.body;

        // Validation
        if (!name || !email || !password) {
          return res
            .status(400)
            .json({ error: "Name, email, and password are required fields." });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        const newAdmin = {
          name,
          email,
          password: hashedPassword,
        };

        const result = await AdminCollection.insertOne(newAdmin);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    app.get("/usersStudentRequested", async (req, res) => {
      try {
        const users = await UserCollection.find({
          Role: "Student",
          Status: "Pending",
        }).toArray();
        res.json(users);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    app.get("/usersStudentApproved", async (req, res) => {
      try {
        const users = await UserCollection.find({
          Role: "Student",
          Status: "Approved",
        }).toArray();
        res.json(users);
      } catch (error) {
        console.error("Error fetching approved students:", error);
        res.status(500).json({ error: error.message });
      }
    });

    app.patch("/users/:id/updateStatus", async (req, res) => {
      try {
        const userId = req.params.id;
        const { action } = req.body;

        let updateStatus;
        if (action === "approve") {
          updateStatus = "Approved";
        } else if (action === "decline") {
          updateStatus = "Declined";
        } else {
          res.status(400).json({ message: "Invalid action" });
          return;
        }

        const result = await UserCollection.updateOne(
          { _id: new ObjectId(userId) }, // Note the use of 'new'
          { $set: { Status: updateStatus } }
        );

        if (result.modifiedCount === 0) {
          res.status(404).json({ message: "User not found" });
          return;
        }

        if (action === "decline") {
          await UserCollection.deleteOne({ _id: new ObjectId(userId) }); // Note the use of 'new'
        }

        res.json({
          message: `User status updated to ${updateStatus} successfully`,
        });
      } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/usersAlumniRequested", async (req, res) => {
      try {
        const users = await UserCollection.find({
          Role: "Alumni",
          Status: "Pending",
        }).toArray();
        res.json(users);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    app.get("/usersAlumniApproved", async (req, res) => {
      try {
        const users = await UserCollection.find({
          Role: "Alumni",
          Status: "Approved",
        }).toArray();
        res.json(users);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get all students
    app.get("/users", async (req, res) => {
      try {
        const { role, status } = req.query;

        let query = {};
        if (role) {
          query.role = role;
        }

        if (status) {
          query.status = status;
        }

        const students = await UserCollection.find(query).toArray();
        res.json(user);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    // Get student by ID
    app.get("/students/:id", async (req, res) => {
      try {
        const studentId = req.params.id;
        const student = await UserCollection.findOne({
          S_id: studentId,
        });
        if (!student) {
          res.status(404).json({ message: "Student not found" });
          return;
        }
        res.json(student);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Update student by ID
    app.put("/students/:id", async (req, res) => {
      try {
        const studentId = req.params.id;
        const updatedStudent = req.body;
        const result = await UserCollection.updateOne(
          { _id: ObjectId(studentId) },
          { $set: updatedStudent }
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Delete student by ID
    app.delete("/students/:id", async (req, res) => {
      try {
        const studentId = req.params.id;
        const result = await UserCollection.deleteOne({
          _id: ObjectId(studentId),
        });
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    // Create an alumni
    // app.post("/addAlumni", async (req, res) => {
    //   try {
    //     const newAlumni = req.body;
    //     const result = await UserCollection.insertOne(newAlumni);
    //     res.json(result);
    //   } catch (error) {
    //     res.status(500).json({ error: error.message });
    //   }
    // });

    // Get all alumni
    app.get("/alumni", async (req, res) => {
      try {
        const alumni = await UserCollection.find({}).toArray();
        res.json(alumni);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get alumni by ID
    app.get("/alumni/:id", async (req, res) => {
      try {
        const alumniId = req.params.id;
        const alumni = await UserCollection.findOne({
          _id: ObjectId(alumniId),
        });
        if (!alumni) {
          res.status(404).json({ message: "Alumni not found" });
          return;
        }
        res.json(alumni);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Update alumni by ID
    app.put("/alumni/:id", async (req, res) => {
      try {
        const alumniId = req.params.id;
        const updatedAlumni = req.body;
        const result = await UserCollection.updateOne(
          { _id: ObjectId(alumniId) },
          { $set: updatedAlumni }
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Delete alumni by ID
    app.delete("/alumni/:id", async (req, res) => {
      try {
        const alumniId = req.params.id;
        const result = await UserCollection.deleteOne({
          _id: ObjectId(alumniId),
        });
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    // Create a teacher
    app.post("/addTeacher", async (req, res) => {
      try {
        const newTeacher = req.body;
        const result = await TeacherCollection.insertOne(newTeacher);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get all teachers
    app.get("/teachers", async (req, res) => {
      try {
        const teachers = await TeacherCollection.find({}).toArray();
        res.json(teachers);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get teacher by ID
    app.get("/teachers/:id", async (req, res) => {
      try {
        const teacherId = req.params.id;
        const teacher = await TeacherCollection.findOne({
          _id: ObjectId(teacherId),
        });
        if (!teacher) {
          res.status(404).json({ message: "Teacher not found" });
          return;
        }
        res.json(teacher);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Update teacher by ID
    app.put("/teachers/:id", async (req, res) => {
      try {
        const teacherId = req.params.id;
        const updatedTeacher = req.body;
        const result = await TeacherCollection.updateOne(
          { _id: ObjectId(teacherId) },
          { $set: updatedTeacher }
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Delete teacher by ID
    app.delete("/teachers/:id", async (req, res) => {
      try {
        const teacherId = req.params.id;
        const result = await TeacherCollection.deleteOne({
          _id: ObjectId(teacherId),
        });
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    // Create a job post
    app.post("/addJob", async (req, res) => {
      try {
        const newJobPost = req.body;
        const result = await JobPostCollection.insertOne(newJobPost);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get all job posts
    app.get("/jobs", async (req, res) => {
      try {
        const jobPosts = await JobPostCollection.find({}).toArray();
        res.json(jobPosts);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get job post by ID
    app.get("/jobs/:id", async (req, res) => {
      try {
        const jobPostId = req.params.id;
        const jobPost = await JobPostCollection.findOne({
          _id: ObjectId(jobPostId),
        });
        if (!jobPost) {
          res.status(404).json({ message: "Job post not found" });
          return;
        }
        res.json(jobPost);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Update job post by ID
    app.put("/jobs/:id", async (req, res) => {
      try {
        const jobPostId = req.params.id;
        const updatedJobPost = req.body;
        const result = await JobPostCollection.updateOne(
          { _id: ObjectId(jobPostId) },
          { $set: updatedJobPost }
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Delete job post by ID
    app.delete("/jobs/:id", async (req, res) => {
      try {
        const jobPostId = req.params.id;
        const result = await JobPostCollection.deleteOne({
          _id: ObjectId(jobPostId),
        });
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get event by ID
    app.get("/events/:id", async (req, res) => {
      try {
        const eventId = req.params.id;
        const event = await EventCollection.findOne({ _id: ObjectId(eventId) });
        if (!event) {
          res.status(404).json({ message: "Event not found" });
          return;
        }
        res.json(event);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Update event by ID
    app.put("/events/:id", async (req, res) => {
      try {
        const eventId = req.params.id;
        const updatedEvent = req.body;
        const result = await EventCollection.updateOne(
          { _id: ObjectId(eventId) },
          { $set: updatedEvent }
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Delete event by ID
    app.delete("/events/:id", async (req, res) => {
      try {
        const eventId = req.params.id;
        const result = await EventCollection.deleteOne({
          _id: ObjectId(eventId),
        });
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  }
}

run().catch(console.error);

// Example "API running" route
app.get("/", (req, res) => {
  res.send("API running");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
