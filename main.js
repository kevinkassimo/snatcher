var fs = require('fs');
var config = JSON.parse(fs.read('config.json', 'utf8'));
console.log("Logging " + config.username + " onto myUCLA.");

var url = {
    logon:   "https://be.my.ucla.edu",
    planner:  "https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx",
    findandenroll: "https://sa.ucla.edu/ro/classsearch/"
};


function logon(url) {
    var page = require('webpage').create();
    page.onConsoleMessage = function(msg, lineNum, sourceId) {
        console.log('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")');
    };
    var WAIT = 7000;
    var loginCookie = null;
    var courses = config.courses.slice(0);
    for (var i = 0; i < courses.length; i++) {
        courses[i] = [courses[i], 0];
    }

    function fillin(status) {
        var inputs = page.evaluate(function(config) {
            function click(el){
                var ev = document.createEvent("MouseEvent");
                ev.initMouseEvent(
                    "click",
                    true /* bubble */, true /* cancelable */,
                    window, null,
                    0, 0, 0, 0, /* coordinates */
                    false, false, false, false, /* modifier keys */
                    0 /*left*/, null
                );
                el.dispatchEvent(ev);
            }
            document.getElementById("logon").value = config.username;
            document.getElementById("pass").value = config.password;
            click(document.querySelector("button"));
        }, config);

        page.render('logon.png');
        console.log("Logging in");

        setTimeout( function(){
            page.render('frontpage.png');
            loginCookie = page.cookies;

            page.evaluate(function() {
                document.querySelector("a[href='https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx']").click();
            });

            setTimeout(function() {
                setPlanner();
            }, WAIT * 1.6); // wait for class planner page to redirect
        }, WAIT); // wait for home page
    }

    var count = 0;
    function setPlanner() {
        console.log("Class Planner page opened");
        page.render('planner' + '.png');

        page.evaluate(function(config, courses) {
            var sem = config.semester;
            var sel = document.getElementById("ctl00_MainContent_termSessionChooser_TermChooser");
            console.log(sel);
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
        setTimeout(makeQuery, WAIT * 2);
    }


    function sendEmail(name, enrollment, time) {
        function toQueryString(obj) {
            var str = '';
            for (var key in obj) {
                str += key + '=' + encodeURIComponent(obj[key]) + '&';
            }
            return str.slice(0, str.length - 1);
        }

        var body = {
            "from": "Mailgun Sandbox <postmaster@sandbox64b3024307024ea38e0944d3e7d40474.mailgun.org>",
            "to": config.firstname + " " + config.lastname + " <" + config.email + ">",
            "subject": "Hello ",
            "text": "Hi, \n This is your course scanner service to remind you that a new spot has shown up "
                + "on your course " + name + " with capacity of " + enrollment[0] + " out of " + enrollment[1] 
                + ". Hope you go for it real quick ! "
                + "\n\n Best, \n Your faithful Snatcher"
        };

        var gun = require('webpage').create(), 
            server = "https://api:key-c61f93d8f12742dab476c0a77fe6af12@api.mailgun.net/v3/sandbox64b3024307024ea38e0944d3e7d40474.mailgun.org/messages",
            data = toQueryString(body);

        gun.onConsoleMessage = function(msg, lineNum, sourceId) {
            console.log('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")');
        };

        console.log("data : " + data);

        gun.open(server, 'POST', data, function(status) {
            if (status === 'success') {
                console.log("Email successfully sent");
            } else {
                console.log("Email not sent.");
            }
        });

    }

    function makeQuery(status) {
        console.log("Switched to quarter ", config.semester);
        page.render("beforequery.png");

        console.log("Courses to be queried : " + courses);

        poll();
        setInterval(poll, 60000);

        function poll() {
            var result = page.evaluate(function(config, courses) {
                var resultList = [];
                var divlist = document.querySelectorAll(".iweBodyTable");
                var list = [];
                for (var i = 0; i < divlist.length; i++) {
                    list.push(divlist[i]);
                }

                function getCourse(course) {
                    var result = null;
                    try {
                        for (var i = 0; i < list.length; i++) {
                            var d = list[i];
                            var classname = d.nextElementSibling.dataset.classname;
                            if (classname.indexOf(course) !== -1) {
                                result = d;
                                break;
                            }
                        }
                        result = result.querySelectorAll("tbody")[1];
                        result = result.children[0];
                        result = result.children[2].childNodes[1].textContent;
                    } catch (_) {
                        return null;
                    }
                    return result;
                }

                console.log("Courses: " + courses);
                for (var i = 0; i < courses.length; i++) {
                    var courseinfo = courses[i];
                    var result = getCourse(courseinfo[0]);
                    if (result === null) return console.log("No info found for course " + courseinfo[0]);

                    var status = 0;
                    if (result.toLowerCase().indexOf("full") === -1 && result.toLowerCase().indexOf("closed") === -1) {
                        var match = /(\d+)\s*of\s*(\d+)/.exec(result);
                        console.log("match is " + match);
                        status = [match[1], match[2]];
                    }

                    if (courseinfo[1] === 0 && status !== 0) {
                        // new spots appear
                        console.log("NEW SPOT !!!!!!!!!!!!!!!!!!!! ");
                        resultList.push( [courseinfo[0], status, new Date().toDateString()] );
                    }
                    else {
                        resultList.push( null );
                    }

                    courseinfo[1] = status;
                    console.log(courseinfo[0] + " result: " + result);
                }

                return {
                    resultList: resultList, 
                    newCourses: JSON.toString(courses)
                };

            }, config, courses);

            courses = JSON.parse(result.newCourses);
            console.log("courses info updated to ", courses);
            result.resultList.forEach( function(result) {
                if (result) {
                    sendEmail.apply(this, result);
                }
            });
        }
    }

    page.open(url, function(status) {
        setTimeout(function(){ fillin(status);}, WAIT);
    });
}

logon(url.planner);
