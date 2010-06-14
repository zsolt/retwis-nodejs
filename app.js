// $ kiwi install redis-client

var sys = require("sys"), 
    kiwi = require("kiwi"),
    client = kiwi.require("redis-client").createClient();

Timeline = function() {};

Timeline.prototype.page = function(pageIndex, callback) {
    var from      = (pageIndex-1)*10
    var to        = (pageIndex)*10
    client.lrange('timeline', from, to, function (err, values) {
        if (err) callback(err)
        else {
            var posts = [];
            values.forEach(function(elem, i) {
               posts.push(new Post(elem)); 
            });
            callback(null, posts);
        }
    });
    
};

Post = function(id) {
    this.id = id;
};

["content", "user_id", "created_at"].forEach(function(field, i) {
    Post.prototype["get_" + field] = function(callback) {
        client.get("post:id:" + this.id + ":" + field, function(err, value) {
            if (err) callback(err)
            else {
                callback(null, value);
            }        
        });  
    };
    Post.prototype["set_" + field] = function(value, callback) {
        client.set("post:id:" + this.id + ":" + field, value, function(err, value) {
            if (err) callback(err)
            else {
                callback(null, value);
            }        
        });  
    };
});

client.info(function (err, info) {
    if (err) throw new Error(err);
    sys.puts("redis version: " + info.redis_version);
    var timeline = new Timeline();
    
    var post = new Post(1);
    post.get_content(function(err, value) {
        sys.puts("Value of post 1: " + value);
        post.set_content("Modified at " + new Date(), function(err, value) {});
    });

    timeline.page(1, function (err, values) {
        if (err) callback(err)
        else {
            sys.puts("Timeline: ");
            values.forEach(function(post, i) {
               post.get_content(function(err, value) {
                    sys.puts(post.id + ": " + value);                  
               }); 
            });
            client.close();
        }
    });
});

