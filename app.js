// $ kiwi install redis-client

var sys = require("sys"), 
    kiwi = require("kiwi"),
    client = kiwi.require("redis-client").createClient();
kiwi.require('express');
require('express/plugins');

configure(function(){
  use(ContentLength)
  use(Static)
  use(Logger)
  use(Cookie)
  use(Session)
  use(Hooks)
  enable('show exceptions')

  set('root', __dirname);
})

RedisClient = client;

require("./domain");
require("./login-signup");

helpers = {
  
};

get('/', function(){
  this.contentType('html');
  var user = this.session["user"]
  var self = this
  user.timeline(1, function(err, posts) {
    self.render("index.html.ejs", {
      locals: {
          title: "Retwis-nodejs",
          posts: posts,
          posting_error: null,
          helpers: helpers
      }
    });      
  })
})

get('/timeline', function(){
  this.contentType('html');
  var self = this;
  var posts =[];

  Timeline.page(1, function (err, posts) {
    self.render("timeline.html.ejs", {
      locals: {
          title: "Retwis-nodejs",
          posts: posts
      }
    });                                        
  });

});

post('/post', function() {
  var posting_error = null
  if (this.param('content').length == 0)
    posting_error = "You didn't enter anything."
  else if (this.param('content').length > 140)
    posting_error = "Keep it to 140 characters please!"
  
  var user = this.session["user"]
  if (posting_error) {
    var self = this
    user.timeline(1, function(err, posts) {
      self.render("index.html.ejs", {
        locals: {
            title: "Retwis-nodejs",
            posts: posts,
            posting_error: posting_error
        }
      });      
    })
  } else {
    Post.create(user, this.param('content'))
    this.redirect('/')
  }

});

run();
