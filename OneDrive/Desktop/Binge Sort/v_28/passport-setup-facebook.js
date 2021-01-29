const passport         = require("passport")
      FacebookStrategy = require("passport-facebook").Strategy

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(id, done) {
  done(null,user)
});

passport.use(new FacebookStrategy({
  clientID        : "486226905671513",
  clientSecret    : "b3c743293b56ee1642ca5ff3387f7617",
  callbackURL     : "http://localhost:3000/facebook/callback",
  profileFields   : ['id','displayName','name','gender','picture.type(large)','email']
},
function(token, refreshToken, profile, done) {
  console.log(profile)
  return done(null,profile)
}));
