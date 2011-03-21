// $ kiwi install redis-client

var sys = require("sys"), 
    client = require("redis").createClient(),
    express = require("express");
    
app = express.createServer();

app.configure(function(){
  app.use(express.logger('\x1b[33m:method\x1b[0m \x1b[32m:url\x1b[0m :response-time'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'keyboard cat' }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.register('.html', require('ejs'));

app.set('views', __dirname + '/views');
app.set('view engine', 'html');

RedisClient = client;

require("./domain");
require("./login-signup");

app.dynamicHelpers({
   current_user: function(req) {
     return req.session.user;
   }, 
   req: function(req) {
     return req;
   }
})

app.get('/', authenticated, function(req, res){
  res.contentType('html');
  var user = req.session.user
  User.timeline(user.id, 1, function(err, posts) {
    User.followers(user.id, function(err, followers) {
      User.followees(user.id, function(err, followees) {
        res.render("index", {
          locals: {
              title: "Retwis-nodejs",
              posts: posts,
              followers: followers,
              followees: followees,
              posting_error: null
          }
        });      
      });      
    });    
  })
})

app.get('/timeline', function(req, res){
  res.contentType('html');
  var posts =[];

  Timeline.page(1, function (err, posts) {
    User.new_users(function(err, newUsers) {
      res.render("timeline", {
        locals: {
            title: "Retwis-nodejs",
            posts: posts,
            newUsers: newUsers
        }
      });
    });                                        
  });

});


app.post('/post', authenticated, function(req, res) {
  var posting_error = null
  if (req.param('content').length == 0)
    posting_error = "You didn't enter anything."
  else if (req.param('content').length > 140)
    posting_error = "Keep it to 140 characters please!"
  
  var user = req.session["user"]
  if (posting_error) {
    User.timeline(user.id, 1, function(err, posts) {
      User.followers(user.id, function(err, followers) {
        User.followees(user.id, function(err, followees) {
          res.render("index", {
            locals: {
                title: "Retwis-nodejs",
                posts: posts,
                followers: followers,
                followees: followees,
                posting_error: posting_error
            }
          });      
        });      
      });      
    })
  } else {
    Post.create(user, req.param('content'), function(err, post) {
        res.redirect('/')   
    })
  }

});

app.get('/:username', authenticated, function(req, res){
  var current_user = req.session["user"]
  User.find_by_username(req.params.username, function(err, user) {
    User.posts(user.id, 1, function(err, posts) {
      User.followers(user.id, function(err, followers) {
        User.followees(user.id, function(err, followees) {
          User.isFollowing(current_user.id, user.id, function(err, isFollowing) {        
          res.render("profile", {
            locals: {
                title: "Retwis-nodejs ~ " + user.username,
                followers: followers,
                followees: followees,
                isFollowing: isFollowing,
                posts: posts,
                user: user
            }
          });      
          });      
        });      
      });            
    });
  })
});

app.get('/:username/mentions', authenticated, function(req, res) {
  User.mentions(req.params.username, 1, function(err, mentions) {
    res.render("mentions", {
        locals: {
          title: "Retwis-nodejs",
          posts: mentions
      }
    });
  });
});

app.get('/:username/follow', authenticated, function(req, res){
  var current_user = req.session["user"]
  User.find_by_username(req.params.username, function(err, user) {
    User.follow(current_user.id, user.id, function() {
      res.redirect('/' + user.username)
    });
  });  
});

app.get('/:username/stopfollow', authenticated, function(req, res){
  var current_user = req.session["user"]
  User.find_by_username(req.params.username, function(err, user) {
    User.stopFollowing(current_user.id, user.id, function() {
      res.redirect('/' + user.username)
    });
  });  
});

app.listen(3000);
console.log("Started up on port 3000");
