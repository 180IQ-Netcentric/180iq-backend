require("dotenv").config();
require("./config/database").connect();
const express = require("express");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();
const { HASH_SALT } = process.env;
const auth = require("./middleware/auth");

app.use(express.json());

// Logic goes here

module.exports = app;

// importing user context
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
    const token = jwt.sign(
      { user_id: user._id, username },
      process.env.TOKEN_KEY,
      {
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
    // Validate if user exist in our database
    const user = await User.findOne({ username });

    if (user && (await bcrypt.compare(password, user.password))) {
      // Create token
      const token = jwt.sign(
        { user_id: user._id, username },
        process.env.TOKEN_KEY,
        {
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

//scoreboard
app.get("/scoreboard", auth, async (req, res) => {
  const users = await User.find({}, { username: 1, win: 1, lose: 1, score: 1, _id: 0 }).sort( { "score": -1, "_id": 1 } ) ;
  return res.status(200).json(users);
});

//win
app.put("/username", auth, async (req, res) => {
  const {username} = req.body

  if (!username) {
    return res.status(400).send({
      reason: "BAD_REQUEST",
      message: "All input is required",
    });
  }

  const oldUser = await User.findOne({ username });

  if (oldUser) {
    return res.status(409).send({
      reason: "USERNAME_ALREADY_USED",
      message: "This username is already used. Please try again.",
    });
  }

  const user = await User.findOneAndUpdate({ "_id": req.user.user_id },{ $set: { "username": username} })
  if (!(user)) {
    return res.status(404).send({
      reason: "NOT_FOUND",
      message: "This object id is no longer exist.",
    });
  }
  return res.status(200).json();
});

//win
app.put("/win", auth, async (req, res) => {

  const user = await User.findOneAndUpdate({ "_id": req.user.user_id },{ $inc: { "win": 1, "score": 1 } })
  if (!(user)) {
    return res.status(404).send({
      reason: "NOT_FOUND",
      message: "This object id is no longer exist.",
    });
  }
  return res.status(200).json();
});

//win
app.put("/lose", auth, async (req, res) => {

  const user = await User.findOneAndUpdate({ "_id": req.user.user_id },{ $inc: { "lose": 1, "score": -1 } })
  if (!(user)) {
    return res.status(404).send({
      reason: "NOT_FOUND",
      message: "This object id is no longer exist.",
    });
  }
  return res.status(200).json();
});