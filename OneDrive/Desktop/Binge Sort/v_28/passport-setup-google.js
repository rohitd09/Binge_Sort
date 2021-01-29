const passport       = require("passport")
      GoogleStrategy = require("passport-google-oauth2").Strategy

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

passport.use(new GoogleStrategy({
  clientID: "1018253947530-t0mv5e0itt0gih27v60csbf4elcnrgok.apps.googleusercontent.com",
  clientSecret: "sgPtQvFfbDdmjUZtUUMfkWkr",
  callbackURL: "http://localhost:3000/google/callback",
  passReqToCallback: true
}, function(request, accessToken, refreshToken, profile, done){
  console.log(profile)
  return done(null, profile)
}))
