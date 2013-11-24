Array.prototype.take = function(count) {
    var result = [];
    for (var i = 0; i < this.length && i < count; i++) {
        result.push(this[i]);
    }
    return result;
};

Array.prototype.skip = function(count) {
    if (this.length === 0){
        return [];
    }
    var result = [];
    var i = 0;
    while (i < count && i < this.length){
        i++;
    }
    while (i < this.length) {
        result.push(this[i++]);
    }
    return result;
};