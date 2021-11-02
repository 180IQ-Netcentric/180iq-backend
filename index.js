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


//For admin state
app.get("/adminState", auth, async (req, res) =>{
  if (req.user.role != "Admin") {
    res.status(401).send({
      reason: "Unauthorized",
      message: "Only admin can use this api",
    });
  }
  return res.status(200).json({
    isUser: false
  })
})
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

// FOR TEST ONLY !!!
app.get("/testGame", auth, async (req, res) => {

  if (req.user.role != "User") {
    res.status(401).send({
      reason: "Unauthorized",
      message: "Only user can use this api",
    });
  }

  const { digit, round } = req.body

  if (!(digit && round)) {
    return res.status(400).send({
      reason: "BAD_REQUEST",
      message: "All input is required",
    });
  }
  const questions = []
  for (let i = 0; i < round; i++) {
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
      for (let j = 0; j < operator.length; j++) {
        // console.log("round: "+j)
        // console.log("first number: " + result)
        // console.log("operator: " + operator[j])
        // console.log("second number: "+number[j+1])
        switch (operator[j]) {
          case 0: result += number[j + 1]; break;
          case 1: result -= number[j + 1]; break;
          case 2: result = result * number[j + 1]; break;
          case 3: result = result / number[j + 1]; break;
        }
        // console.log("result: " + result)
        // console.log("_____________________")
      }
    }
    question = {
      number: number,
      operator: operator,
      result: result,
    }
    questions.push(question)
  }
  return res.status(200).json({
    questions: questions,
  });
});

// Socket

let setting = { // default game setting
  digit: 5,
  round: 3,
  timeLimit: 90,
  isClassicMode: true,
}

let playerInfos = []

let gameInfo = {
  setting: setting,
  player1: {
    username: null,
    score: 0,
    timeUsed: null,
  },
  player2: {
    username: null,
    score: 0,
    timeUsed: null,
  },
  firstPlayer: null,
  currentRound: null,
  questions: null
}

let receivedVSModeRoundWinner = false

function shuffle(array) {
  let currentIndex = array.length,  randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

function removeFromArray(id, playerInfos) {
  for (var i = 0; i < playerInfos.length; i++) {
    if (playerInfos[i].id === id) {
      playerInfos.splice(i, 1);
      return playerInfos
    }
  }
  return playerInfos
}

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

function generateQuestions(digit, round) {
  const questions = []
  for (i = 0; i < round; i++) {
    var result = 0.5
    var chance = Math.random()
    while (!isValid(result, chance)) {
      var number = [];
      while (number.length < digit) {
        var r = Math.floor(Math.random() * 10);
        if (number.indexOf(r) === -1) number.push(r);
      }
      var operator = [];
      while (operator.length < digit - 1) {
        var r2 = Math.floor(Math.random() * 4);
        operator.push(r2);
      }
      result = number[0]
      for (let i = 0; i < operator.length; i++) {
        switch (operator[i]) {
          case 0: result += number[i + 1]; break;
          case 1: result -= number[i + 1]; break;
          case 2: result = result * number[i + 1]; break;
          case 3: result = result / number[i + 1]; break;
        }
      }
    }
    const numberShuffle = shuffle([...number]);
    question = {
      number: number,
      operator: operator,
      result: result,
      numberShuffle: numberShuffle,
    }
    questions.push(question)
  }
  return questions
}

io.on("connection", function (socket) {
  console.log("Initial Connection Successful!");
  io.emit("updateSetting", setting) // show setting

  socket.on("joinRoom", function (playerInfo) {
    console.log(`${JSON.stringify(playerInfo)} Connected!"`);
    isAlreadyJoin = false;
    for(let i = 0;i<playerInfos.length;i++){
      if(playerInfos[i].id===this.id){
        isAlreadyJoin = true
        playerInfos[i] = playerInfo
      }
    }
    if(!isAlreadyJoin) playerInfos.push(playerInfo); // updates player list
    console.log(playerInfos)
    io.emit("updatePlayerList", playerInfos)  // send back to client
  });

  socket.on("updateSetting", function (newSetting) {
    console.log("Setting is being updated.");
    setting = newSetting
    io.emit("updateSetting", setting)
    console.log(setting)
  });

  socket.on("playerStartGame", function () {
    receivedVSModeRoundWinner = false
    gameInfo = {
      setting: setting,
      player1: {
        username: null,
        score: 0,
        timeUsed: null,
      },
      player2: {
        username: null,
        score: 0,
        timeUsed: null,
      },
      firstPlayer: null,
      currentRound: null,
      questions: null
    }
    console.log("Initialize gameplay")
    gameInfo.player1.username = playerInfos[0].username
    gameInfo.player2.username = playerInfos[1].username
    gameInfo.questions = generateQuestions(setting.digit, setting.round)
    gameInfo.setting = setting
    gameInfo.currentRound = 1
    const random = Math.random()
    if (random > 0.5) {
      gameInfo.firstPlayer = gameInfo.player1.username
    } else {
      gameInfo.firstPlayer = gameInfo.player2.username
    }
    io.emit("startRound", gameInfo)
  });

  socket.on("nextTurn", function (playerInfo) {
    if (gameInfo.player1.username === playerInfo.username) {
      gameInfo.player1.timeUsed = playerInfo.timeUsed
    } else {
      gameInfo.player2.timeUsed = playerInfo.timeUsed
    }
    io.emit("startNextTurn", gameInfo)
  })

  socket.on("endRound", function (playerInfo) {
    console.log('receivedEndRound')
    if (!setting.isClassicMode) {
      if (receivedVSModeRoundWinner) return
      receivedVSModeRoundWinner = true
    }
    winnerUsername = null
    if (setting.isClassicMode) { //classic mode
      if (gameInfo.player1.username === playerInfo.username) {
        gameInfo.player1.timeUsed = playerInfo.timeUsed
      } else {
        gameInfo.player2.timeUsed = playerInfo.timeUsed
      }
      timeUsed1 = gameInfo.player1.timeUsed
      timeUsed2 = gameInfo.player2.timeUsed
      if (timeUsed1 < timeUsed2) {
        gameInfo.player1.score++
        winnerUsername = gameInfo.player1.username
        gameInfo.firstPlayer = winnerUsername
      } else if (timeUsed2 < timeUsed1) {
        gameInfo.player2.score++
        winnerUsername = gameInfo.player2.username
        gameInfo.firstPlayer = winnerUsername
      } else {
        gameInfo.firstPlayer = playerInfo.username
      }
    } else {  //vs mode
      if (playerInfo.timeUsed === setting.timeLimit) {
        gameInfo.firstPlayer = playerInfo.username
      } else {
        if (gameInfo.player1.username === playerInfo.username) {
          gameInfo.player1.score++
        } else {
          gameInfo.player2.score++
        }
        winnerUsername = playerInfo.username
        gameInfo.firstPlayer = winnerUsername
      }
    }

    if(gameInfo.currentRound === setting.round){
      io.emit("endGame", gameInfo)
      console.log("End game")
      gameInfo = {
        setting: setting,
        player1: {
          username: null,
          score: 0,
          timeUsed: null,
        },
        player2: {
          username: null,
          score: 0,
          timeUsed: null,
        },
        firstPlayer: null,
        currentRound: null,
        questions: null
      }
      console.log(gameInfo)
    }else{
      io.emit("announceWinner", {gameInfo, winnerUsername})
    }
  })

  socket.on("nextRound", function () {
    receivedVSModeRoundWinner = false
    gameInfo.currentRound++
    io.emit("startRound", gameInfo)
  })

  socket.on("chatMessage", function ({username, message}) {
    console.log(username + ' sent ' + message)
    socket.broadcast.emit("sendChatMessage", { username, message })
  })

  //Server side
  socket.on("showAllPlayers", function () {
    io.emit("onShowAllPlayers", playerInfos)
  })

  socket.on("resetByAdmin", function () {
    setting = { // default game setting
      digit: 5,
      round: 3,
      timeLimit: 90,
      isClassicMode: true,
    }

    gameInfo = {
      setting: setting,
      player1: {
        username: null,
        score: 0,
        timeUsed: null,
      },
      player2: {
        username: null,
        score: 0,
        timeUsed: null,
      },
      firstPlayer: null,
      currentRound: null,
      questions: null
    }
    io.emit("onResetByAdmin", setting)
  })
  
  socket.on("disconnectUser", function () {
    console.log(`${this.id} left the game`);
    playerInfos = removeFromArray(this.id, playerInfos)
    io.emit("updatePlayerList", playerInfos)
    console.log(playerInfos)
  });

  socket.on("disconnect", function () {
    console.log(`${this.id} left the game`);
    playerInfos = removeFromArray(this.id, playerInfos)
    io.emit("updatePlayerList", playerInfos)
    console.log(playerInfos)
  });
});