Timeline = function() {};

Timeline.page = function(pageIndex, callback) {
    var from = (pageIndex-1) * 10;
    var to = pageIndex * 10;
    RedisClient.lrange('timeline', from, to, function (err, values) {
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
