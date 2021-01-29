const mongoose = require("mongoose")

const TelevisionSchema = new mongoose.Schema({
  show_name: String,
  popularity: {
    type: String,
    enum: ['New Released', 'Most Popular', 'Trending', 'General'],
    default: 'General'
  },
  genre: {
    type: Array,
    default: []
  },
  source: String,
  synopsis: String,
  image: String,
  Number_of_Seasons: {
    type: Number,
    default: 0
  },
  Number_of_Episodes: {
    type: Number,
    default: 0
  },
  visited_number: {
    type: Number,
    default: 0
  },
  Total_Score: {
    type: Number,
    default: 0
  },
  Users_Scored: {
    type: Number,
    default: 0
  },
  Avg_Score: {
    type: Number,
    default: 0
  }
})

module.exports = mongoose.model("Television", TelevisionSchema)
