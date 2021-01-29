const mongoose              = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  watch_list: [{
    television_id: String,
    status: String,
    Episodes_Watched: {
      type: Number,
      default: 0
    },
    score: {
      type: Number,
      default: 0
    }
  }],
  resetPasswordToken: String,
  resetPasswordExpires: Date
});

UserSchema.plugin(passportLocalMongoose)

module.exports = mongoose.model("User", UserSchema)
