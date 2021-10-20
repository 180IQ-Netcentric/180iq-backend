const http = require("http");
const app = require("./app");
const server = http.createServer(app);
const io = require('socket.io')(http);

const { API_PORT } = process.env;
const port = process.env.PORT || API_PORT;

// server listening 
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

io.on("connection", function (socket) {
  let setting = {
    "digit": 5,
    "round": 3,
    "timeLimit": 90,
    "isBasicMode": true,
  } 
  console.log("Connected!");
  io.emit("updateSetting",setting)  

  socket.on("updateSetting", function(setting){
    console.log("Setting is being updated.");
    io.emit("updateSetting",setting)
  });
  socket.on("disconnect", function(){
    console.log("Someone left the game");
  });
});