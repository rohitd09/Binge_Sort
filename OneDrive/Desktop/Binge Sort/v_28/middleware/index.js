const User = require("../models/users")

var middlewareObj = {};

middlewareObj.isLoggedin = function(req, res, next) {
  if(req.isAuthenticated()){
    return next();
  } else {
    req.flash("error", "You need to be Logged in to do that.");
    return res.redirect("/login");
  }
}

middlewareObj.isAdmin = function(req, res, next) {
  if(req.isAuthenticated()){
    if(req.user.role == "admin"){
      return next();
    } else {
      console.log(req.user.role);
      res.redirect("back");
    }
  } else {
    res.redirect("/")
  }
}

module.exports = middlewareObj;
