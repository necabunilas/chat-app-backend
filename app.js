//jshint esversion:6
require("dotenv").config;
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require("mongoose");
const ejs = require('ejs');
const socket = require("socket.io");
const bcrypt = require("bcryptjs");
const saltRounds = 10;

const app = express();
const port = 5000;

app.set('view engine', 'ejs');

//For local files
app.use(express.static("public"));

//necessary to get the submitted values from index.html
app.use(bodyParser.urlencoded({extended:true}));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE, OPTIONS');
  next();
});

//connect to db
mongoose.connect("mongodb+srv://admin:admin@cluster0-f5d15.mongodb.net/chatUserDB", { useUnifiedTopology: true,  useNewUrlParser: true  });

//user schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});

//message schema
const chatSchema = new mongoose.Schema({
  username: String,
  message: String
});

const User = new mongoose.model("User", userSchema);
const Chat = new mongoose.model("Chat", chatSchema);

app.get("/", function(req,res){
  res.send("Listening for messages!");
})

//localost listener
const server = app.listen(process.env.PORT || port, function(){
  console.log(`App listening at http://localhost:` + port)
});

let loggedUsers = [];

//websocket variable
const io = socket(server);

//check for connection
io.on('connection', (socket) => {
  //handle Login
  console.log("connect");
  socket.on('login', (data) => {
    const {username, password} = data;
    User.findOne({username: username}, function(err, foundUser){
      if(!err){
        //check password after getting email
        if(foundUser){
          bcrypt.compare(password, foundUser.password, function(err,result){

            if(result === true){
              console.log("User exists");

              loggedUsers.push({username: username, socket: socket.id});
              console.log(loggedUsers);
              socket.emit("login", "ok");
            }else{
              console.log("Wrong Password!");
              socket.emit("login", "wp");
            }

          });
        }else{
          //register user
          console.log("User not found!, registering user!");
          bcrypt.hash(password, saltRounds, function(err,hash){

            const newUser = new User({
              username: username,
              password: hash
            });

            newUser.save(function(err){
              if(!err){
                console.log("Successfully registered: " + newUser);
                socket.emit("login", "ok");
              }else{
                console.log("Error registering");
                socket.emit("login", "er");
              }
            });

          });

        }
      }else{
        console.log(err);
      }
    })
  })

  //handle chat
  socket.on('message', (data) => {
    console.log(data);

    const {username, message} = data;

    const newMessage = new Chat({
      username: username,
      message: message
    });

    newMessage.save(function(err){
      if(!err){
        io.sockets.emit("message", newMessage);
      }else{
        socket.emit("message", "er");
      }
    });

  })

  socket.on('forceDisconnect', () => {
    let iDisconnect;
    loggedUsers.map(function(user,index){
      if(user.socket === socket.id){
        iDisconnect = index;
      }
    })
    loggedUsers.splice(iDisconnect,1);
    console.log(loggedUsers);
    socket.disconnect();
  })

});
