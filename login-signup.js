var sys = require("sys");


authenticated = function(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
};

app.get('/login', function(req, res) {
  res.render("login", {
    locals: {
      login_error: null,
      signup_error: null
    }
  })                         
});

app.post('/login', function(req, res) {
  User.find_by_username(req.param('username'), function(err, user) {
    if (user && user.hashedPassword == User.hash_pw(user.salt, req.param('password'))) {
      req.session["user"] = user      
      res.redirect("/")             
    } else {
      res.render("login", {
        locals: {
          login_error: "Incorrect username or password",
          signup_error: null
        }
      })        
    }
  })
}); 

app.get('/logout', function(req, res) {
  req.session["user"] = null
  res.redirect('/login')
});

app.post('/signup', function(req, res) {
  var signup_error = null
  
  if (!req.param('username').match(/^\w+$/)) {
    signup_error = "Username must only contain letters, numbers and underscores."
    res.render("login", {
      locals: {
          login_error: null,
          signup_error: signup_error
      }
    })
  }
  else {
    RedisClient.get("user:username:" + req.param('username'), function(err, value) {
      if (value)
        signup_error = "That username is taken."
      else if (req.param('username').length < 4)
        signup_error = "Username must be at least 4 characters"
      else if (req.param('password').length < 6)
        signup_error = "Password must be at least 6 characters!"
      else if (req.param('password') != req.param('password_confirmation'))
        signup_error = "Passwords do not match!"
      
      if (signup_error)
        res.render("login", {
          locals: {
              login_error: null,
              signup_error: signup_error
          }
        })
      else {
        User.create(req.param('username'), req.param('password'), function(err, user) {
          req.session["user"] = user
          res.redirect("/")            
        })
      }          
    });
  }


});
