const express        = require("express")
      bodyParser     = require("body-parser")
      mongoose       = require("mongoose")
      flash          = require("connect-flash")
      path           = require("path")
      passport       = require("passport")
      nodemailer     = require("nodemailer")
      async          = require("async")
      crypto         = require("crypto")
      LocalStrategy  = require("passport-local")
      methodOverride = require("method-override")
      multer         = require("multer")
      app            = express();

      User           = require("./models/users")
      Television     = require("./models/television")

      middleware     = require("./middleware")

      storage        = multer.diskStorage({
        destination: './public/uploads/',
        filename: function(req, file, cb){
          cb(null, file.fieldname + '_' + Date.now() + path.extname(file.originalname));
        }
      })

      upload         = multer({
        storage: storage
      }).single('image')

      require( "./passport-setup-google")
      require( "./passport-setup-facebook")

mongoose.connect("mongodb://localhost/nosql_project", { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.set("useCreateIndex", true);
mongoose.set('useFindAndModify', false);
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.use(flash());

app.use(require("express-session")({
  secret: "Option",
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next){
  res.locals.currentUser = req.user;
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
});

app.get("/", function(req, res){
  Television.countDocuments({}, function(err, count){
    Television.find({}).sort({Avg_Score: -1}).exec(function(err, television){
      for(i = 0; i < count; i++){
        if(i < 8){
          Television.findOneAndUpdate({show_name: television[i].show_name}, {$set: {popularity: "Most Popular"}}, function(err, updated){})
        } else {
          if(television[i].popularity == "New Released"){
            Television.findOneAndUpdate({show_name: television[i].show_name}, {$set: {popularity: "New Released"}}, function(err, updated){})
          } else {
            Television.findOneAndUpdate({show_name: television[i].show_name}, {$set: {popularity: "General"}}, function(err, updated){})
          }
        }
      }
    })
  })
  Television.countDocuments({$or: [{popularity: "Trending"}, {popularity: "General"}, {popularity: "New Released"}]}, function(err, count){
    Television.find({$or: [{popularity: "Trending"}, {popularity: "General"}, {popularity: "New Released"}]}).sort({visited_number: -1}).exec(function(err, televisionUpdate){
      for(i = 0; i < count; i++){
        if(i < 8){
          Television.findOneAndUpdate({show_name: televisionUpdate[i].show_name}, {$set: {popularity: "Trending"}}, function(err, updated){})
        } else {
          if(televisionUpdate[i].popularity == "New Released"){
            Television.findOneAndUpdate({show_name: televisionUpdate[i].show_name}, {$set: {popularity: "New Released"}}, function(err, updated){})
          } else {
            Television.findOneAndUpdate({show_name: televisionUpdate[i].show_name}, {$set: {popularity: "General"}}, function(err, updated){})
          }
        }
      }
    })
  })
  res.redirect("/show");
});

app.get("/new_shows", function(req, res){
  Television.find({popularity: "New Released"}, function(err, television){
    if(err){
      res.redirect("/")
    } else {
      res.render("new_shows", {television: television})
    }
  })
});

app.get("/show", function(req, res){
  Television.find({$or: [{popularity: "New Released"},   {popularity: "Trending"}, {popularity: "Most Popular"}]}, function(err, television){
    if(err){
      console.log(err);
    } else {
      res.render("landing", {television: television});
    }
  })
});

app.get("/show/:id", function(req, res){
  var flag = 0
  Television.findById(req.params.id, function(err, television){
    if(err){
      res.redirect("/");
    } else {
      Television.findOneAndUpdate({_id: req.params.id}, {$set: {visited_number: television.visited_number + 1}}, function(err, inc){
        if(err){
          console.log(err);
        } else {
          Television.countDocuments({$or: [{popularity: "Trending"}, {popularity: "General"}, {popularity: "New Released"}]}, function(err, count){
            Television.find({$or: [{popularity: "Trending"}, {popularity: "General"}, {popularity: "New Released"}]}).sort({visited_number: -1}).exec(function(err, televisionUpdate){
              for(i = 0; i < count; i++){
                if(i < 8){
                  Television.findOneAndUpdate({show_name: televisionUpdate[i].show_name}, {$set: {popularity: "Trending"}}, function(err, updated){})
                } else {
                  if(televisionUpdate[i].popularity == "New Released"){
                    Television.findOneAndUpdate({show_name: televisionUpdate[i].show_name}, {$set: {popularity: "New Released"}}, function(err, updated){})
                  } else {
                    Television.findOneAndUpdate({show_name: televisionUpdate[i].show_name}, {$set: {popularity: "General"}}, function(err, updated){})
                  }
                }
              }
            })
          })
        }
      })
      if(!req.isAuthenticated()){
        flag = 0
        res.render("show", {television: television, flag: flag});
      } else {
        User.find({username: req.user.username}, {_id: 0, watch_list: 1}, function(err, watchList){
          if(err){
            console.log(err);
          } else {
            var watchListArray = watchList[0].watch_list;
            var score = null;
            var episodes_watched = 0
            watchListArray.forEach(function(tv_id){
              console.log(req.params.id);
              if(tv_id.television_id == req.params.id){
                score = tv_id.score;
                episodes_watched = tv_id.Episodes_Watched
                flag = 1
              }
            });
            res.render("show", {television: television, flag: flag, score: score, episodes_watched: episodes_watched});
          }
        });
      }
    }
  });
});

app.put("/show/:id/update", middleware.isLoggedin, function(req, res){
  async.waterfall([
    function(done){
      var televisionId     = req.body.television_id
          status           = req.body.status
          score            = parseInt(req.body.score)
          episodes_watched = parseInt(req.body.episodes_watched)
          current_score = 0
          flag          = 0
      User.findOne({username: req.user.username}, function(err, userFound){
        prevCheck = userFound.watch_list
        prevCheck.forEach(function(check){
          if(check.television_id == req.params.id){
            if(check.score > 0){
              flag = 1
              current_score = score - check.score
              console.log("current_score: " + current_score);
          } else {
            current_score = score
            console.log("current_score: " + current_score);
          }
        }
      })
      console.log("Flag1: " + flag);
      done(err, televisionId)
    })
  },
  function(televisionId, done){
    User.findOneAndUpdate({username: req.user.username, "watch_list.television_id": televisionId}, {$set: {"watch_list.$.status": status, "watch_list.$.score": score, "watch_list.$.Episodes_Watched": episodes_watched}}, function(err, updated){
      if(err){
        res.redirect("/")
      } else {
        done(err, televisionId)
      }
    })
  },
  function(televisionId, done){
    var totScore    = 0
        usersScored = 0
        newTotScore = 0
    console.log("Flag2: " + flag);
    Television.findById(req.params.id, function(err, television){
      if(score != 0){
        totScore    = television.Total_Score
        usersScored = television.Users_Scored
        newTotScore = totScore + current_score
        console.log("Total Score0: " + current_score);
        console.log("Total Score1: " + newTotScore);
        console.log("Flag3: " + flag);
        if(flag != 1){
            usersScored += 1
        }
        done(err, televisionId)
      } else {
        totScore    = television.Total_Score
        usersScored = television.Users_Scored - 1
        newTotScore = totScore + current_score
        console.log("Total Score0: " + current_score);
        console.log("Total Score1: " + newTotScore);
        console.log("Current: " + current_score);
        console.log("Flag3: " + flag);
        done(err, televisionId)
      }
    });
  },
  function(televisionId, done){
    console.log("Users Scored: " + usersScored);
    console.log("Total Score: " + newTotScore);
    avgScore = newTotScore / usersScored
    Television.findOneAndUpdate({_id: req.params.id}, {$set: {Total_Score: newTotScore, Users_Scored: usersScored, Avg_Score: avgScore}}, function(err, television){
      if(err){
        res.redirect("/")
      } else {
        done(err, televisionId)
      }
    }
  )},
  function(televisionId, done){
    Television.countDocuments({}, function(err, count){
      Television.find({}).sort({Avg_Score: -1}).exec(function(err, television){
        for(i = 0; i < count; i++){
          if(i < 8){
            Television.findOneAndUpdate({show_name: television[i].show_name}, {$set: {popularity: "Most Popular"}}, function(err, updated){})
          } else {
            if(television[i].popularity == "New Released"){
              Television.findOneAndUpdate({show_name: television[i].show_name}, {$set: {popularity: "New Released"}}, function(err, updated){})
            } else {
              Television.findOneAndUpdate({show_name: television[i].show_name}, {$set: {popularity: "General"}}, function(err, updated){})
            }
          }
        }
        req.flash("success", "Your Database was Updated");
        res.redirect("/mylist");
      })
    })
  }
  ], function(err){
    res.redirect("/")
  })
});

app.delete("/show/:id", middleware.isLoggedin, function(req, res){
  var score = 0
  User.findOne({username: req.user.username}, {_id: 0, watch_list: 1}, function(err, user_watch_list){
    user_watch_list.watch_list.forEach(function(tv){
      if(tv.television_id == req.params.id){
        score = tv.score
      }
    })
    Television.findById(req.params.id, function(err, television){
      var currentScore = television.Total_Score - score
          usersScored  = television.Users_Scored - 1
          avgScore     = currentScore / usersScored
      Television.findOneAndUpdate({_id: req.params.id}, {$set: {Total_Score: currentScore, Users_Scored: usersScored, Avg_Score: avgScore}}, function(err, updated){})
    });
    User.findOneAndUpdate({username: req.user.username}, {$pull: {watch_list: {television_id: req.params.id}}}, function(err, deleted){
      if(err){
        console.log(err);
      } else {
        req.flash("success", "Show Removed from your Database");
        res.redirect("/mylist");
      }
    });
  });
});

app.put("/show/:id", middleware.isLoggedin, function(req, res){
  var televisionId = req.body.television_id;
  User.findOneAndUpdate({username: req.user.username}, {$push: {watch_list: {television_id: televisionId, status: "Plan To Watch", score: 0}}}, function(err, updated){
    if(err){
      console.log(err);
    } else {
      req.flash("success", "Your Database Was Updated, A show has been inserted");
      res.redirect("/mylist");
    }
  });
});

app.get("/all_show", function(req, res){
  Television.find({"show_name": {$exists: true}}).sort({"show_name": 1}).exec(function(err, television){
    if(err){
      console.log(err);
    } else {
      res.render("search_shows/all_show", {television: television});
    }
  });
});

app.post("/all_show", function(req, res){
  if(req.body.genre == null){
    Television.find({"show_name": {$exists: true}}).sort({"show_name": 1}).exec(function(err, television){
      if(err){
        console.log(err);
      } else {
        res.render("search_shows/all_show", {television: television});
      }
    });
  } else {
    var check = req.body.check
    if(check == 1){
      Television.find({"show_name": {$exists: true}, "genre": {$all: req.body.genre}}).sort({"show_name": 1}).exec(function(err, television){
        if(err){
          console.log(err);
        } else {
          res.render("search_shows/all_show", {television: television})
        }
      });
    } else {
      Television.find({"show_name": {$exists: true}, "genre": {$in: req.body.genre}}).sort({"show_name": 1}).exec(function(err, television){
        if(err){
          console.log(err);
        } else {
          res.render("search_shows/all_show", {television: television})
        }
      });
    }
  }
});

app.post("/search_show", function(req, res){
  var show_name = req.body.show_name;
  if(show_name != ""){
    Television.find({show_name: {$regex: new RegExp("^" + show_name.toLowerCase(), "i")}}, function(err, television){
      if(err){
        console.log(err);
      } else {
        res.render("search_shows/search_show", {television: television, show_name: show_name})
      }
    });
  } else {
    res.redirect("back");
  }
});

app.get("/mylist", middleware.isLoggedin, function(req, res){
  User.find({username: req.user.username}, {_id:0, watch_list:1}, function(err, watchList){
    if(err){
      console.log(err);
    } else {
      var watchListArray = watchList[0].watch_list;
      Television.find({}, function(err, television){
        var television_list = []
        watchListArray.forEach(function(tv_id){
          television.forEach(function(tv){
            if(tv_id.television_id == tv._id && tv_id.status == "Plan To Watch"){
              television_list.push({id: tv._id, status: tv_id.status, image: tv.image, show_name: tv.show_name});
            }
          });
        });
        res.render("mylist/plan_to_watch", {television_list: television_list});
      });
    }
  });
});

app.get("/mylist/on_hold", middleware.isLoggedin, function(req, res){
  User.find({username: req.user.username}, {_id:0, watch_list:1}, function(err, watchList){
    if(err){
      console.log(err);
    } else {
      var watchListArray = watchList[0].watch_list;
      Television.find({}, function(err, television){
        var television_list = []
        watchListArray.forEach(function(tv_id){
          television.forEach(function(tv){
            if(tv_id.television_id == tv._id && tv_id.status == "On Hold"){
              television_list.push({id: tv._id, status: tv_id.status, image: tv.image, show_name: tv.show_name});
            }
          });
        });
        res.render("mylist/on_hold", {television_list: television_list});
      });
    }
  });
});

app.get("/mylist/dropped", middleware.isLoggedin, function(req, res){
  User.find({username: req.user.username}, {_id:0, watch_list:1}, function(err, watchList){
    if(err){
      console.log(err);
    } else {
      var watchListArray = watchList[0].watch_list;
      Television.find({}, function(err, television){
        var television_list = []
        watchListArray.forEach(function(tv_id){
          television.forEach(function(tv){
            if(tv_id.television_id == tv._id && tv_id.status == "Dropped"){
              television_list.push({id: tv._id, status: tv_id.status, image: tv.image, show_name: tv.show_name});
            }
          });
        });
        res.render("mylist/dropped", {television_list: television_list});
      });
    }
  });
});

app.get("/mylist/completed", middleware.isLoggedin, function(req, res){
  User.find({username: req.user.username}, {_id:0, watch_list:1}, function(err, watchList){
    if(err){
      console.log(err);
    } else {
      var watchListArray = watchList[0].watch_list;
      Television.find({}, function(err, television){
        var television_list = []
        watchListArray.forEach(function(tv_id){
          television.forEach(function(tv){
            if(tv_id.television_id == tv._id && tv_id.status == "Completed"){
              television_list.push({id: tv._id, status: tv_id.status, image: tv.image, show_name: tv.show_name});
            }
          });
        });
        res.render("mylist/completed", {television_list: television_list});
      });
    }
  });
});

app.get("/mylist/watching", middleware.isLoggedin, function(req, res){
  User.find({username: req.user.username}, {_id:0, watch_list:1}, function(err, watchList){
    if(err){
      console.log(err);
    } else {
      var watchListArray = watchList[0].watch_list;
      Television.find({}, function(err, television){
        var television_list = []
        watchListArray.forEach(function(tv_id){
          television.forEach(function(tv){
            if(tv_id.television_id == tv._id && tv_id.status == "Watching"){
              television_list.push({id: tv._id, status: tv_id.status, image: tv.image, show_name: tv.show_name});
            }
          });
        });
        res.render("mylist/watching", {television_list: television_list});
      });
    }
  });
});

app.get("/admin/add_data", middleware.isAdmin, middleware.isLoggedin, function(req, res){
  res.render("admin/admin");
});

app.post("/admin/add_data", middleware.isAdmin, middleware.isLoggedin, function(req, res){
  upload(req, res, (err) => {
    if(err){
      req.flash("error", " Oops! Something went Wrong");
      return res.redirect("/admin/add_data");
    } else {
      console.log("Working");
      var addTelevision = new Television({
        show_name: req.body.show_name,
        popularity: req.body.popularity,
        source: req.body.source,
        synopsis: req.body.synopsis,
        genre: req.body.genre,
        image: req.file.filename,
        Number_of_Episodes: req.body.number_of_episodes,
        Number_of_Seasons: req.body.number_of_seasons
      });

      Television.create(addTelevision, function(err, newlyAdded){
        if(err){
          console.log(err);
          req.flash("error", "Data not inserted in Database, please try again");
          return res.redirect("/admin");
        } else {
          req.flash("success", "Data inserted in Database Successfully");
          return res.redirect("/admin/add_data");
        }
      });
    }
  })
})

app.get("/admin_edit", middleware.isAdmin, function(req, res){
  var flag = 0
  res.render("admin/admin_edit", {flag: flag});
});

app.post("/admin_edit", middleware.isAdmin, function(req, res){
  var search = req.body.search_show;
  Television.find({show_name: {$regex:  new RegExp("^" + search.toLowerCase(), "i")}}, function(err, found){
    if(err){
      console.log(err);
    } else {
      var flag = 1
      res.render("admin/admin_edit", {found: found, flag: flag})
    }
  });
});

app.get("/admin_edit/:id/update", middleware.isAdmin, function(req, res){
  Television.findById({_id: req.params.id}, function(err, television){
    if(err){
      console.log(err);
    } else {
      res.render("admin/show_update", {television: television});
    }
  });
});

app.put("/admin_edit/:id/update", middleware.isAdmin, function(req, res){
  var show_name          = req.body.show_name
      popularity         = req.body.popularity
      source             = req.body.source
      genre              = req.body.genre
      synopsis           = req.body.synopsis
      number_of_episodes = req.body.number_of_episodes
      number_of_seasons  = req.body.number_of_seasons

  Television.findOneAndUpdate({_id: req.params.id}, {$set: {show_name: show_name, genre: genre, popularity: popularity, source: source, synopsis: synopsis, Number_of_Episodes: number_of_episodes, Number_of_Seasons: number_of_seasons}}, function(err, updated){
    if(err){
      console.log(err);
    } else {
      req.flash("success", "Show Updated Successfully");
      res.redirect("/admin_edit");
    }
  });
});

app.delete("/admin_edit/:id/delete", middleware.isAdmin, function(req, res){
  Television.deleteOne({_id: req.params.id}, function(err, deleted){
    if(err){
      console.log(err);
    } else {
      req.flash("success", "Show Deleted Successfully");
      res.redirect("/admin_edit");
    }
  });
});

app.get("/admin", middleware.isAdmin, function(req, res){
  Television.find({}).sort({visited_number: -1}).exec(function(err, television){
    User.find({}).countDocuments().exec(function(err, numberOfUsers){
      Television.find({}).countDocuments().exec(function(err, numberOfShows){
        res.render("admin/dashboard", {television: television, numberOfUsers: numberOfUsers, numberOfShows: numberOfShows});
      })
    })
  });
});

app.get("/register", function(req, res){
	res.render("register");
});

app.post("/register", function(req, res){
  var username = req.body.username;
  var password = req.body.password;
  var re_password = req.body.re_password;
  var pattern = (/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/);
  var email_pattern = (/^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/);

  if(!email_pattern.test(username)){
    console.log("Invalid Email");
    req.flash("error", "Invalid Email");
    return res.redirect("/register");
  } else if(password != re_password) {
    console.log("Password match");
    req.flash("error", "Password does not match");
    return res.redirect("/register");
  } else if (!pattern.test(password)) {
    console.log("Invalid Password");
    req.flash("error", "Password must contain minimum 8 characters long, atleast one Upper Case, one Lower Case, one Number, and one Special Character");
    return res.redirect("/register");
  } else {
    var newUser = new User({username: req.body.username});
    User.register(newUser, req.body.password, function(err, user){
      if(err){
        console.log(err);
        req.flash("error", err.message);
        return res.redirect("/register");
      }
      passport.authenticate("local", {
        successRedirect: "/",
        failureRedirect: "/register",
        failureFlash: true
      })(req, res);
    });
  }
});

app.get('/facebook', passport.authenticate('facebook', { scope : 'email' }));

app.get('/facebook/callback',
		passport.authenticate('facebook', {
			successRedirect : '/api-login',
			failureRedirect : '/'
}));

app.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get("/google/callback", passport.authenticate("google", {failureRedirect: "/login"}), function(req, res){
  res.redirect('/api-login');
});

app.get("/api-login", function(req, res){
  async.waterfall([
    function(done){
      var email = req.user.email
      req.logout()
      console.log("Working1");
      User.countDocuments({username: email}, function(err, count){
        console.log(email);
        console.log(count);
        done(err, email, count)
      });

    },
    function(email, count, done){
      if(count > 0){
        console.log("Working3.0");
        User.findOne({username: email}, function(err, user){
          console.log(user);
          req.logIn(user, function(err){
            done(err, email, count, user)
          })
        });
      } else {
        function makeid(length) {
           var result           = '';
           var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
           var charactersLength = characters.length;
           for ( var i = 0; i < length; i++ ) {
              result += characters.charAt(Math.floor(Math.random() * charactersLength));
           }
           return result;
        }
        var password = makeid(10)
        var newUser = new User({username: email})
        console.log("Working3.25");
        User.register(newUser, password, function(err, user){
          console.log("Working3.5");
          req.logIn(user, function(err){
            done(err, email, count, user)
          })
        })
      }
    }
  ], function(err){
    res.redirect("/");
  })
});

app.get("/login", function(req, res){
	res.render("login");
});

app.post("/login", passport.authenticate("local", {
  successRedirect: "/",
  failureRedirect: "/login",
  failureFlash: true
}), function(req, res){}
);

app.get("/forgot_password", function(req, res){
  res.render("forgot_password");
});

app.post("/forgot_password", function(req, res){
  async.waterfall([
    function(done){
      crypto.randomBytes(20, function(err, buf){
        var token = buf.toString("hex");
        done(err, token)
      });
    },
    function(token, done){
      User.findOne({username: req.body.email}, function(err, user){
        if(!user){
          req.flash("error", "An account with the given Email does not exists");
          return res.redirect("/forgot_password");
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000;

        user.save(function(err){
          done(err, token, user);
        });
      });
    },

    function(token, user, done){
      var Transport = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "bingesort7@gmail.com",
          pass: "Sumanrohit29"
        }
      });

      var mailOptions = {
        to: user.username,
        from: "bingesort7@gmail.com",
        subject: "Binge Sort Forgot Password and Reset",
        text: `You are receiving this message because you have requested for a password reset for your account. \n\n` +
              `To complete your password reset procedure click on the following link\n\n` +
              `http://` + req.headers.host + `/reset/` + token + `\n\n` +
              `The following link will be active for next 1 hour\n\n` +
              `If you did not request for any password reset, please ignore this message and your password will remain unchanged\n`
      };

      Transport.sendMail(mailOptions, function(err){
        console.log("Mail Sent");
        req.flash("success", "An email has been sent to " + user.username);
        done(err, 'done');
      });
    }
  ], function(err){
    if(err){
      return next(err);
    } else {
      res.redirect("/forgot_password");
    }
  });
});

app.get("/reset/:token", function(req, res){
  User.findOne({resetPasswordToken: req.params.token, resetPasswordExpires: {$gt: Date.now()}}, function(err, user){
    if(err){
      req.flash("error", "Password reset code invalid or expired.");
      res.redirect("/forgot_password");
    } else {
      res.render("reset", {token: req.params.token});
    }
  });
});

app.post("/reset/:token", function(req, res){
  async.waterfall([
    function(done){
      User.findOne({resetPasswordToken: req.params.token, resetPasswordExpires: {$gt: Date.now()}}, function(err, user){
        if(!user){
          req.flash("error", "Password reset code invalid or expired.");
          return res.redirect("back")
        }
        var pattern = (/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/);
        if(pattern.test(req.body.password)){
          if(req.body.password == req.body.confirm){
            user.setPassword(req.body.password, function(err){
              user.resetPasswordToken = undefined;
              user.resetPasswordExpires = undefined;

              user.save(function(err){
                req.logIn(user, function(err){
                  done(err, user);
                });
              });
            });
          } else {
            req.flash("error", "Passwords do not match.");
            return res.redirect("back")
          }
        } else {
          req.flash("error", "Password must contain minimum 8 characters long, atleast one Upper Case, one Lower Case, one Number, and one Special Character");
          return res.redirect("back")
        }
      });
    }, function(user, done) {
      var Transport = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'bingesort7@gmail.com',
          pass: 'Sumanrohit29'
        }
      });

      var mailOptions = {
        to: user.username,
        from: 'bingesort7@gmail.com',
        subject: "Your Password Has been Changed",
        text: `Hello,\n\n` +
              `This is a confirmation email that the passsword for your account ` + user.username + ` has been changed Successfully.\n`
      };

      Transport.sendMail(mailOptions, function(err){
        req.flash("success", "Your password has been changed");
        done(err);
      });
    }
  ], function(err){
    res.redirect("/")
  });
});

app.get("/logout", function(req, res){
  req.logout();
  req.flash("success", "Logged you out");
  res.redirect("/");
});

app.listen(3000, function(){
  console.log("Server Started at Port 3000")
})
