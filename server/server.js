require("dotenv").config();

const firestoreDB = require("./firebaseInit");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const instructorRoutes = require("./routes/instructorRoutes");
const studentRoutes = require("./routes/studentRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());
app.use("/", instructorRoutes);
app.use("/", studentRoutes);
app.use("/", authRoutes);

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`${socket.id} joined room: ${roomId}`);
  });

  socket.on("sendMessage", async (data) => {
    try {
      const { roomId, sender, message } = data;

      if (!roomId || !sender || !message) {
        return;
      }

      const messageData = {
        roomId,
        sender,
        message,
        createdAt: new Date(),
      };

      await firestoreDB.collection("messages").add(messageData);

      io.to(roomId).emit("receiveMessage", messageData);
    } catch (error) {
      console.log("Send message error:", error.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

app.get("/messages/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;

    const snapshot = await firestoreDB.collection("messages").where("roomId", "==", roomId).get();

    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    messages.sort((a, b) => {
      const timeA = a.createdAt?.toDate?.()?.getTime?.() || 0;

      const timeB = b.createdAt?.toDate?.()?.getTime?.() || 0;

      return timeA - timeB;
    });

    return res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    console.log("Get messages error:", error.message);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
