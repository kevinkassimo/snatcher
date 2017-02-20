var fs = require('fs');
var steps = [];
var testindex = 0;
var loadInProgress = false;
var config = JSON.parse(fs.read('config.json', 'utf8'));
var courses = config.courses.slice(0);

var page = require("webpage").create(),
    url = "https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx";

var trigger = function(identity){
  var rect = page.evaluate(function(s){
      return document.querySelector(s).getBoundingClientRect();
    }, identity);
  page.sendEvent('click', rect.left + rect.width / 2, rect.top + rect.height / 2);
}

page.settings.userAgent = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36';
page.settings.javascriptEnabled = true;
page.settings.loadImages = false;//Script is much faster with this field set to false
phantom.cookiesEnabled = true;
phantom.javascriptEnabled = true;

console.log('All settings loaded, start with execution');
page.onConsoleMessage = function(msg) {
  console.log(msg);
}

steps = [
  function(){
    console.log("Step 1 - Open myUCLA home page");
    page.open(url, function(status){
    });
  },
  function(){
    console.log('Step 2 - Populate and submit the login form');
    page.render("startPage.png");
    var rect = page.evaluate(function(config){
      document.getElementById("logon").value=config.username;
      document.getElementById("pass").value=config.password;
      return document.forms[0].querySelector('button[name="_eventId_proceed"]').getBoundingClientRect();
    }, config);
    page.sendEvent('click', rect.left + rect.width / 2, rect.top + rect.height / 2);
    page.render('Logon.png');

  },
  function(){
    console.log("Step 3 - Wait myUCLA to login user.");
    page.render("waitLogon.png");
  },
  function(){
    console.log("Step 4 - Switch to term 17S");
    page.render("beforeSelection.png");
    page.evaluate(function(config, courses) {
        var sem = config.semester;
        var sel = document.getElementById("ctl00_MainContent_termSessionChooser_TermChooser");
        var opts = sel.options;
        for (var j = 0; j < opts.length; j++){
            var opt = opts[j];
            log("Trying selector value " , opt.value);
            if (opt.value == sem){
                sel.selectedIndex = j;
                break;
            }
        }
        var evt = document.createEvent("HTMLEvents");
        evt.initEvent("change", false, true);
        sel.dispatchEvent(evt);
    }, config, courses);
  },
  function(){
    console.log("Step 5 - Refresh");
    page.reload();
    page.render('beforeQuery.png');
  },
  function(){
    console.log("Step 6 - Refresh");
    page.render('myUCLA5.png');
    page.render('beforeQuery2.png');
  },
];

interval = setInterval(executeRequestsStepByStep,50);
 
function executeRequestsStepByStep(){
    if (loadInProgress == false && typeof steps[testindex] == "function") {
        //console.log("step " + (testindex + 1));
        steps[testindex]();
        testindex++;
    }
    if (typeof steps[testindex] != "function") {
        console.log("test complete!");
        phantom.exit();
    }
}
 
/**
 * These listeners are very important in order to phantom work properly. Using these listeners, we control loadInProgress marker which controls, weather a page is fully loaded.
 * Without this, we will get content of the page, even a page is not fully loaded.
 */
page.onLoadStarted = function() {
    loadInProgress = true;
    console.log('Loading started');
};
page.onLoadFinished = function() {
    loadInProgress = false;
    console.log('Loading finished');
};
page.onConsoleMessage = function(msg) {
    console.log(msg);
};