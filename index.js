require("dotenv").config();
require("./config/database").connect();
const express = require("express");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();
const cors = require('cors');
const { HASH_SALT } = process.env;
const auth = require("./middleware/auth");
const http = require("http").Server(app);
const io = require('socket.io')(http, {
  cors: {
    origin: '*',
  }
});

const { API_PORT } = process.env;
const port = process.env.PORT || API_PORT;

app.use(express.json());
app.use(cors())

http.listen(port, function () {
  console.log(`listening on port ${port}`);
});

function isPrime(num) {
  if (!isFinite(num)) return false
  for (var i = 2; i < num; i++)
    if (num % i === 0) return false;
  return num > 1;
}

function isValid(num, chance) {
  if (chance > 0.67) return isPrime(num) && (num % 1 === 0) && num > 20 && num < 90
  return num % 1 === 0
}

// Importing user context
const User = require("./model/user");

// Register
app.post("/register", async (req, res) => {

  // Our register logic starts here
  try {
    // Get user input
    const { username, password } = req.body;

    // Validate user input
    if (!(password && username)) {
      return res.status(400).send({
        reason: "BAD_REQUEST",
        message: "All input is required",
      });
    }

    if (username == "180iq_admin") {
      return res.status(400).send({
        reason: "INVALID_USERNAME",
        message: "This username is not available",
      });
    }

    // check if user already exist
    // Validate if user exist in our database
    const oldUser = await User.findOne({ username });

    if (oldUser) {
      return res.status(409).send({
        reason: "USERNAME_ALREADY_USED",
        message: "This username is already used. Please try again.",
      });
    }

    //Encrypt user password
    encryptedPassword = await bcrypt.hash(password, Number(HASH_SALT));

    // Create user in our database
    const user = await User.create({
      username,
      password: encryptedPassword,
      win: 0,
      lose: 0,
      score: 0,
    });

    // Create token
    const token = jwt.sign({ user_id: user._id, role: "User" },
      process.env.TOKEN_KEY, {
      expiresIn: "7d",
    }
    );

    // return new user
    res.status(201).json({
      username: user.username,
      win: user.win,
      lose: user.lose,
      score: user.score,
      jwt: token,
      isUser: true
    });
  } catch (err) {
    console.log(err);
  }
  // Our register logic ends here
});

// Login
app.post("/login", async (req, res) => {

  // Our login logic starts here
  try {
    // Get user input
    const { username, password } = req.body;

    // Validate user input
    if (!(username && password)) {
      return res.status(400).send({
        reason: "BAD_REQUEST",
        message: "All input is required",
      });
    }

    if ((username == "180iq_admin") && (password == "netcentric_180_iq")) {
      const token = jwt.sign({ role: "Admin" },
        process.env.TOKEN_KEY, {
        expiresIn: "7d",
      }
      );
      return res.status(200).json({
        jwt: token,
        isUser: false
      })
    }

    // Validate if user exist in our database
    const user = await User.findOne({ username });

    if (user && (await bcrypt.compare(password, user.password))) {
      // Create token
      const token = jwt.sign({ user_id: user._id, role: "User" },
        process.env.TOKEN_KEY, {
        expiresIn: "7d",
      }
      );

      // user
      return res.status(200).json({
        username: user.username,
        win: user.win,
        lose: user.lose,
        score: user.score,
        jwt: token,
        isUser: true
      });
    }
    res.status(400).send({
      reason: "INCORRECT_USERNAME_OR_PASSWORD",
      message: "Username or password may be wrong. Please try again.",
    });
  } catch (err) {
    console.log(err);
  }
  // Our register logic ends here
});

// Scoreboard
app.get("/scoreboard", auth, async (req, res) => {

  if (req.user.role != "User") {
    res.status(401).send({
      reason: "Unauthorized",
      message: "Only user can use this api",
    });
  }

  const users = await User.find({}, { username: 1, win: 1, lose: 1, score: 1, _id: 0 }).sort({ "score": -1, "_id": 1 });
  return res.status(200).json(users);
});

// User info
app.get("/userinfo", auth, async (req, res) => {

  if (req.user.role != "User") {
    res.status(401).send({
      reason: "Unauthorized",
      message: "Only user can use this api",
    });
  }

  const user = await User.findOne({ "_id": req.user.user_id })
  if (!(user)) {
    return res.status(404).send({
      reason: "NOT_FOUND",
      message: "This object id is no longer exist.",
    });
  }

  return res.status(200).json({
    username: user.username,
    win: user.win,
    lose: user.lose,
    score: user.score,
  });
})

// Change user name
app.put("/username", auth, async (req, res) => {

  if (req.user.role != "User") {
    res.status(401).send({
      reason: "Unauthorized",
      message: "Only user can use this api",
    });
  }

  const { username } = req.body

  if (!username) {
    return res.status(400).send({
      reason: "BAD_REQUEST",
      message: "All input is required",
    });
  }

  if (username == "180iq_admin") {
    return res.status(400).send({
      reason: "INVALID_USERNAME",
      message: "This username is not available",
    });
  }

  const oldUser = await User.findOne({ username });

  if (oldUser) {
    return res.status(409).send({
      reason: "USERNAME_ALREADY_USED",
      message: "This username is already used. Please try again.",
    });
  }

  const user = await User.findOneAndUpdate({ "_id": req.user.user_id }, { $set: { "username": username } })
  if (!(user)) {
    return res.status(404).send({
      reason: "NOT_FOUND",
      message: "This object id is no longer exist.",
    });
  }
  return res.status(200).json();
});

// Update win score
app.put("/win", auth, async (req, res) => {

  if (req.user.role != "User") {
    res.status(401).send({
      reason: "Unauthorized",
      message: "Only user can use this api",
    });
  }

  const user = await User.findOneAndUpdate({ "_id": req.user.user_id }, { $inc: { "win": 1, "score": 1 } })
  if (!(user)) {
    return res.status(404).send({
      reason: "NOT_FOUND",
      message: "This object id is no longer exist.",
    });
  }
  return res.status(200).json();
});

// Update lose score
app.put("/lose", auth, async (req, res) => {

  if (req.user.role != "User") {
    res.status(401).send({
      reason: "Unauthorized",
      message: "Only user can use this api",
    });
  }

  const user = await User.findOneAndUpdate({ "_id": req.user.user_id }, { $inc: { "lose": 1, "score": -1 } })
  if (!(user)) {
    return res.status(404).send({
      reason: "NOT_FOUND",
      message: "This object id is no longer exist.",
    });
  }
  return res.status(200).json();
});

// Get list of all number
app.get("/number", auth, async (req, res) => {

  if (req.user.role != "User") {
    res.status(401).send({
      reason: "Unauthorized",
      message: "Only user can use this api",
    });
  }

  const { digit } = req.body

  if (!digit) {
    return res.status(400).send({
      reason: "BAD_REQUEST",
      message: "All input is required",
    });
  }
  var result = 0.5
  const chance = Math.random()
  while (!isValid(result, chance)) {
    // console.log("START")
    var number = [];
    while (number.length < digit) {
      var r = Math.floor(Math.random() * 10);
      if (number.indexOf(r) === -1) number.push(r); // Check don't repeat number
    }
    var operator = [];
    while (operator.length < digit - 1) {
      var r2 = Math.floor(Math.random() * 4);
      operator.push(r2);
    }
    result = number[0]
    for (let i = 0; i < operator.length; i++) {
      // console.log("round: "+i)
      // console.log("first number: " + result)
      // console.log("operator: " + operator[i])
      // console.log("second number: "+number[i+1])
      switch (operator[i]) {
        case 0: result += number[i + 1]; break;
        case 1: result -= number[i + 1]; break;
        case 2: result = result * number[i + 1]; break;
        case 3: result = result / number[i + 1]; break;
      }
      // console.log("result: " + result)
      // console.log("_____________________")
    }
  }
  return res.status(200).json({
    number: number,
    operator: operator,
    result: result,
  });
});

app.get("/", async (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on("connection", function (socket) {
  let setting = {
    "digit": 5,
    "round": 3,
    "timeLimit": 90,
    "isBasicMode": true,
  }
  console.log("Connected!");
  io.emit("updateSetting", setting)

  socket.on("updateSetting", function (setting) {
    console.log("Setting is being updated.");
    io.emit("updateSetting", setting)
  });
  socket.on("disconnect", function () {
    console.log("Someone left the game");
  });
});