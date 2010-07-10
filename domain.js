var sys = require("sys"),
    kiwi = require("kiwi"),
    hashlib = kiwi.require("hashlib")


Date.prototype.when = function() {

  var diff = new Date().getTime() - this.getTime();
  var when; // our return value

  if (diff < 0) return this.toString();

  //one or more of these will be non-zero, but we only care about the biggest one (in scale of time)
  if (diff > (2592000000 * 12) ) {
    when = Math.floor(diff/(2592000000 * 12)) + " Year";
  }
  else if (diff > 2592000000) {
    when = Math.floor(diff/2592000000) + " Month";
  }
  else if (diff > 86400000) {
    when = Math.floor(diff/86400000) + " Day";
  }
  else if (diff > 3600000) {
    when = Math.floor(diff/3600000) + " Hour";
  }
  else if (diff > 60000) {
    when = Math.floor(diff/60000) + " Minute";
  }
  else if (diff > 1000) {
    when = Math.floor(diff/1000) + " Second";
  } else if (diff > 0) {
    when = "just now"
  }

  if (typeof when == "undefined") {
      return this.toString()
  }
  //add plural if necessary
  return when != "just now" ? ((0 == when.indexOf("1 ")) ? when : when + "s") + " ago" : when;
};


User = function() {}

User.generateSalt = function() {
  var chars = ['a', 'b', 'c', 'd', 'e', 'f']
  return chars.map(function(item) {
    return chars[Math.floor(Math.random() * chars.length)]
  }).join("")
}

User.hash_pw = function(salt, password) {
  return hashlib.sha1(salt, password)
}

User.create = function(username, password, callback) {
  RedisClient.incr("user:uid", function(err, user_id) {
    if (err) { callback(err); return } 
    var salt = User.generateSalt()
    var hashedPassword = User.hash_pw(salt, password)
    RedisClient.mset("user:id:" + user_id + ":username", username,
      "user:username:" + username, user_id,
      "user:id:" + user_id + ":salt", salt,
      "user:id:" + user_id + ":hashed_password", hashedPassword, 
      function(err) {
        RedisClient.lpush("users", user_id, function(err) {
          if (err) { callback(err); return }
          var user = new User();
          user.id = user_id
          user.username = username
          user.hashedPassword = hashedPassword
          user.salt = salt                        
          callback(null, user)
        })                             
      })
  })
}

User.find_by_username = function(username, callback) {
  RedisClient.get("user:username:" + username, function(err, userId) {
    if (err) callback(err)
    else {
      if (userId) {
        RedisClient.mget("user:id:" + userId + ":username",
        "user:id:" + userId + ":hashed_password",
        "user:id:" + userId + ":salt", 
        function(err, values) {
          if (err) callback(err)
          else {
            var user = new User();
            user.id = userId
            user.username = values[0]
            user.hashedPassword = values[1]
            user.salt = values[2]
            callback(null, user)
          }
        })
      } else {
        // user not found
        callback(null, null)
      }
    }
    
  });
}

User.find_by_id = function(id, callback) {
  RedisClient.get("user:id:" + user_id + ":username", function(err, username) {
    if (err) callback(err, null)    
    else if (username) {
      User.find_by_username(username, callback);
    }
  })
}

User.prototype.timeline = function(page, callback) {
  var from = (page-1) * 10;
  var to = page * 10;
  RedisClient.lrange("user:id:" + this.id + ":timeline", from, to, function(err, values){
    if (err) callback(err)
    else {
      var posts = []
      if (values) {
        values.forEach(function(postId, i) {
          Post.find_by_id(postId, function(err, post) {
            posts.push(post);
            if (i == values.length - 1) {
              // TODO: load post's users
              callback(null, posts)                        
            }                  
          }); 
        });
      } else {
        callback(null, [])
      }                     
    }
  })
};

User.prototype.addPost = function(post, callback) {
  var self = this
  RedisClient.lpush("user:id:" + self.id + ":posts", post.id, function(err) {
    if (err) callback(err)
    else {
      RedisClient.lpush("user:id:" + self.id + ":timeline", post.id, callback)
    }
  })
};

User.prototype.followers = function(callback) {
  RedisClient.smembers("user:id:" + this.id + ":followers", callback)
}

Timeline = function() {};

Timeline.page = function(pageIndex, callback) {
  var from = (pageIndex-1) * 10;
  var to = pageIndex * 10;
  RedisClient.lrange('timeline', from, to, function (err, values) {
    if (err) callback(err)
    else {
      var posts = []
      if (values) {
        values.forEach(function(postId, i) {
          Post.find_by_id(postId, function(err, post) {
            posts.push(post);
            if (i == values.length - 1) {
              callback(null, posts)                        
            }                  
          }); 
        });
      } else {
        callback(null, [])
      } 
    }
  });
    
};

Post = function() {};

Post.find_by_id = function(postId, callback) {
  RedisClient.mget("post:id:" + postId + ":content",
    "post:id:" + postId + ":user_id",
    "post:id:" + postId + ":created_at",
    function(err, values) {
      if (err) callback(err)
      else {
        var post = new Post();
        post.content = values[0]
        post.userId = values[1]
        post.createdAt = values[2]
        callback(null, post)
      }
    }
  )
};

Post.create = function(user, content, callback) {
  RedisClient.incr("post:uid", function(err, postId) {
    if (err) { callback(err); return }
    
    var post = new Post();
    post.id = postId;
    post.content = content
    post.createdAt = new Date().getTime()
    post.userId = user.id
    
    RedisClient.mset("post:id:" + post.id + ":content", post.content,
      "post:id:" + post.id + ":user_id", post.userId,
      "post:id:" + post.id + ":created_at", post.createdAt, 
      function(err) {
        if (err) callback(err)
        else {
          user.addPost(post, function(err) {
            RedisClient.lpush("timeline", post.id, function(err) {
              if (err) callback(err)
              else {
                user.followers(function(err, followers) {
                  if (err) callback(err)
                  else {                
                    if (followers) {
                      followers.forEach(function(follower_id, i) {
                        RedisClient.lpush("user:id:" + follower_id + ":timeline", function(err) {
                          if (i == followers.length - 1) {                      
                            /*

                            content.scan(/@\w+/).each do |mention|
                              if user = User.find_by_username(mention[1..-1])
                                user.add_mention(post)
                              end
                            end
                            */              
                            callback(null, post)
                          }  
                        })
                          
                      })
                    }
                  }
                })
              }
            })
          })                             
            
        }
      })
  })  
};

["content", "user_id", "created_at"].forEach(function(field, i) {
    Post.prototype["get_" + field] = function(callback) {
        RedisClient.get("post:id:" + this.id + ":" + field, function(err, value) {
            if (err) callback(err)
            else {
                callback(null, value);
            }        
        });  
    };
    Post.prototype["set_" + field] = function(value, callback) {
        RedisClient.set("post:id:" + this.id + ":" + field, value, function(err, value) {
            if (err) callback(err)
            else {
                callback(null, value);
            }        
        });  
    };
});

exports.Timeline = Timeline;
exports.Post = Post;
exports.User = User;
