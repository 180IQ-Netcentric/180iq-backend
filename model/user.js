const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: { type: String },
    win: { type: Number },
    lose: { type: Number },
    score: { type: Number }
});

module.exports = mongoose.model("user", userSchema);