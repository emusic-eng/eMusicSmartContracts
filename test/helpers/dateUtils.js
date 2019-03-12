function dateify(unixTimeStampInSeconds, debug) {
    if (debug) console.log("unixTimeStampInSeconds: " + unixTimeStampInSeconds);
    return new Date(unixTimeStampInSeconds * 1000);
}

module.exports = {
    dateify,
};