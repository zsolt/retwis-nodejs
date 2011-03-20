var sys = require("sys"),
    hashlib = require("hashlib")
    Step = require('step')


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
  return hashlib.sha1(salt + password)
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
  RedisClient.get("user:id:" + id + ":username", function(err, username) {
    if (err) callback(err, null)    
    else if (username) {
      User.find_by_username(username, callback);
    }
  })
}

User.new_users = function(callback) {
  RedisClient.lrange("users", 0, 10, function(err, values) {
    if (err) callback(err)
    else {
      var users = []
      if (values) {
        values.forEach(function(userId, i) {
          User.find_by_id(userId, function(err, user) {
            users.push(user);
            if (i == values.length - 1) {
              callback(null, users)                        
            }                  
          }); 
        });
      } else {
        callback(null, [])
      }       
    }   
  })
}

User.timeline = function(user_id, page, callback) {
  var from = (page-1) * 10;
  var to = page * 10;
  RedisClient.lrange("user:id:" + user_id + ":timeline", from, to, function(err, values){
    if (err) callback(err)
    else {
      var posts = []
      if (values && values.length > 0) {
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
  })
};
/*
  def posts(page=1)
    from, to = (page-1)*10, page*10
    redis.list_range("user:id:#{id}:posts", from, to).map do |post_id|
      Post.new(post_id)
    end
  end
*/

User.posts = function(user_id, page, callback) {
  var from = (page-1) * 10;
  var to = page * 10;
  RedisClient.lrange("user:id:" + user_id + ":posts", from, to, function(err, values){
    if (err) callback(err)
    else {
      var posts = []
      if (values && values.length > 0) {
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
  })
};

User.addPost = function(user_id, post, callback) {
  RedisClient.lpush("user:id:" + user_id + ":posts", post.id, function(err) {
    if (err) callback(err)
    else {
      RedisClient.lpush("user:id:" + user_id + ":timeline", post.id, callback)
    }
  })
};

User.followers = function(user_id, callback) {
  RedisClient.smembers("user:id:" + user_id + ":followers", function(err, members) {
    if (err) callback(err)
    else {
      var users = []
      if (members && members.length > 0) {
        members.forEach(function(userId, i) {
          User.find_by_id(userId, function(err, user) {
            users.push(user);
            if (i == members.length - 1) {
              callback(null, users)                        
            }                  
          }); 
        });
      } else {
        callback(null, [])
      }       
    }       
  })
}

User.followees = function(user_id, callback) {
  RedisClient.smembers("user:id:" + user_id + ":followees", function(err, members) {
    if (err) callback(err)
    else {
      var users = []
      if (members && members.length > 0) {
        members.forEach(function(userId, i) {
          User.find_by_id(userId, function(err, user) {
            users.push(user);
            if (i == members.length - 1) {
              callback(null, users)                        
            }                  
          }); 
        });
      } else {
        callback(null, [])
      }       
    }       
  })
}

User.follow = function(user_id, target_user_id, callback) {
  if (user_id == target_user_id) return;
  RedisClient.multi()
    .sadd("user:id:" + user_id + ":followees", target_user_id)
    .sadd("user:id:" + target_user_id + ":followers", user_id)
    .exec(callback)
}

User.stopFollowing = function(user_id, target_user_id, callback) {
  if (user_id == target_user_id) return;
  RedisClient.multi()
    .srem("user:id:" + user_id + ":followees", target_user_id)
    .srem("user:id:" + target_user_id + ":followers", user_id)
    .exec(callback)
}

User.isFollowing = function(user_id, target_user_id, callback) {
    RedisClient.sismember("user:id:" + user_id + ":followees", target_user_id, callback)
}

Timeline = function() {};

Timeline.page = function(pageIndex, callback) {
  var from = (pageIndex-1) * 10;
  var to = pageIndex * 10;
  RedisClient.lrange('timeline', from, to, function (err, values) {
    if (err) callback(err)
    else {
      var posts = []
      if (values && values.length > 0) {
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
        // load author
        User.find_by_id(post.userId, function(err, user) {
            if (err) callback(err)
            else {
              post.user = user
              callback(null, post)
            }
        })        
      }
    }
  )
};


Post.create = function(user, content, callback) {
  var post = null;
  
  Step(
    function() {
      RedisClient.incr("post:uid", this) 
    },
    
    function(err, postId) {
      if (err) throw err;
      post = new Post();
      post.id = postId;
      post.content = content;
      post.createdAt = new Date().getTime();
      post.userId = user.id;
      
      RedisClient.mset("post:id:" + post.id + ":content", post.content,
        "post:id:" + post.id + ":user_id", post.userId,
        "post:id:" + post.id + ":created_at", post.createdAt, this); 
    },
      
    function(err) {
      if (err) throw err;      
      User.addPost(user.id, post, this);
    },
    
    function(err) {
      if (err) throw err;
      RedisClient.lpush("timeline", post.id, this);
    },

    function(err) {
      if (err) throw err;
      User.followers(user.id, this);
    },
    
    function(err, followers) {
      if (err) throw err;
      if (followers && followers.length > 0) {
        var group = this.group();
        followers.forEach(function(follower, i) {
          RedisClient.lpush("user:id:" + follower.id + ":timeline", post.id, group());            
        })
      } else {
        return post;	    
      }    
    },
    
    function(err) {
      callback(err, post);
    }
  )  
};


exports.Timeline = Timeline;
exports.Post = Post;
exports.User = User;
