var original_xmlhttprequest_open = XMLHttpRequest.prototype.open;

function getLoadHandler(requestBody) {
    return function (e) {
      if (this.readyState === this.DONE && this.status >= 200 && this.status < 300) {
        document.dispatchEvent(new CustomEvent("kibanaesresponse", {detail: {request: requestBody, response: this.responseText}}));
      }
    };
};

XMLHttpRequest.prototype.open = function() {
  var method = arguments[0];
  var url = arguments[1];
  // first attach our own listener
  if (/POST/i.test(method) && /https:\/\/kibana.logit.io\/.*\/elasticsearch\/_msearch/.test(url)) {
    this.send = function() {
      if (arguments.length && arguments[0]) {
        this.addEventListener("load", getLoadHandler(arguments[0]));
      }
      XMLHttpRequest.prototype.send.apply(this, arguments)
    };
  }
  // then continue to original implementation
  original_xmlhttprequest_open.apply(this, arguments);
};
