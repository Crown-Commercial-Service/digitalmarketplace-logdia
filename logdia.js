// "mutators" being functions which get called with a selector of parameter-value elements
// after a detail panel has been created, allowing it to make alterations to its display.
// the main intention of these is to allow the code that does the backwards mapping from
// style back to controlling parameter(s) to live next to the code that does the forward mapping -
// that which changes logentry appearance based on parameters.
var detail_value_mutators = [];

var logentry_get_duration = function (log_entry) {
  if (log_entry._source.duration_real != null) {
    return log_entry._source.duration_real * 1000;
  }
  if (log_entry._source.requestTime != null) {
    return log_entry._source.requestTime * 1000;
  }
  if (log_entry._source.api_time != null) {
    return log_entry._source.api_time * 1000;
  }
  return null;
};

var highlight_data_on_mouseover = function(selector, condition_function) {
  selector.classed("with-mouseover", true).on("mouseover", function(d) {
    data_by_type.forEach(function (type_group) {
      type_group.highlight = type_group.values.filter(function(log_entry) {
        return condition_function(log_entry, d);
      });
    });
    highlights_updated();
  }).on("mouseleave", function(d) {
    data_by_type.forEach(function (type_group) {
      type_group.highlight = [];
    });
    highlights_updated();
  });
};

var comparator_from_sort_key = function(sort_key_fn) {
  return function (a, b) {
    var sort_key_a = sort_key_fn(a);
    var sort_key_b = sort_key_fn(b);
    if (sort_key_a > sort_key_b) {
      return 1;
    } else if (sort_key_a < sort_key_b) {
      return -1;
    } else {
      return 0;
    }
  };
};

var type_sort_key = function (type_string) {
  return type_string.split("-").map(function (fragment) {
    return {
      "nginx": "!a",
      "router": "!a",
      "api": "~z",
      "application": "~z",
      "search": "~z" // would actually be part of "search-api"
    }[fragment] || fragment;
  }).join("-");
};

var type_sort_comparator = comparator_from_sort_key(function(item) { return type_sort_key(item.key); });

var http_status_color_function = function(status) {
  var status_string = status + "";
  if (/^\d{3}$/.test(status_string)) {
    if (status_string.startsWith("2")) {
      return "green";
    } else if (status_string.startsWith("3")) {
      return "purple";
    } else if (status_string.startsWith("4")) {
      return "orange";
    } else if (status_string.startsWith("5")) {
      return "red";
    }
  }
};

var get_small_right_symbol_detail_mutator = function(filter_function, pathstr_function) {
  return function(parameter_value) {
    parameter_value.filter(filter_function).select(".right-symbol")
      .attr("width", main_rect_height+2)
      .attr("height", main_rect_height+2)
      .select("path")
        .attr("class", "symbol-shape-outline")
        .style("transform", "translate("
          + ((main_rect_height/2) + 1) + "px, "
          + ((main_rect_height/2) + 1) + "px) "
          + "scale("
          + main_rect_height/2 + ", "
          + main_rect_height/2 + ")"
        ).attr("d", function(d) { return pathstr_function(d.log_entry); });
  };
};

var left_symbol_fill_function = function(log_entry) {
  return http_status_color_function(log_entry._source.status) || null;
};
detail_value_mutators.push(function(parameter_value) {
  parameter_value.filter(function(d) { return d.key === "status"; }).select(".value-text")
    .style("background-color", function(d) {
      return left_symbol_fill_function(d.log_entry);
    }).style("color", "white");
});

var left_symbol_pathstr_function = function(log_entry) {
  var methods = {
    "DELETE": "M1,1h-1v-0.8l-0.7,0.5v-1.4l0.7,0.5v-0.8h1z",
    "POST": "M1,1h-1q-1,-0.2 -1,-1q0,-0.8 1,-1h1z",
    "GET": "M1,1h-1l-1,-1l1,-1h1z",
    "PUT": "M1,1h-1v-0.6h-1v-0.8h1v-0.6h1z",
    "PATCH": "M1,1h-1.5q0.5,-0.5 0,-1q-0.5,-0.5 0,-1h1.5z"
  };

  if (/\bapp\b/.test(log_entry._source.name) && log_entry._source.method && methods.hasOwnProperty(log_entry._source.method)) {
    return methods[log_entry._source.method];
  }
  if (log_entry._source.request) {
    var method_match = log_entry._source.request.match(/^([A-Z]+) .+$/);
    if (method_match && methods.hasOwnProperty(method_match[1])) {
      return methods[method_match[1]];
    }
  }
};
detail_value_mutators.push(
  get_small_right_symbol_detail_mutator(
    function(d) {
      if (/\bapp\b/.test(d.log_entry._source.name) && d.log_entry._source.method) {
        return d.key === "method";
      } else {
        return d.key === "request" && left_symbol_pathstr_function(d.log_entry);
      }
    },
    left_symbol_pathstr_function
  )
);

var right_symbol_fill_function = function(log_entry) {
  return http_status_color_function(log_entry._source.api_status);
};
detail_value_mutators.push(function(parameter_value) {
  parameter_value.filter(function(d) { return d.key === "api_status"; }).select(".value-text")
    .style("background-color", function(d) {
      return right_symbol_fill_function(d.log_entry);
    }).style("color", "white");
});

var right_symbol_pathstr_function = function(log_entry) {
  if (log_entry._source.api_method) {
    if (log_entry._source.api_method === "DELETE") {
      return "M1,1h-2v-2h2v0.8l-0.7,-0.5v1.4l0.7,-0.5z";
    } else if (log_entry._source.api_method === "POST") {
      return "M-1,-1h2Q0,-0.8 0,0Q0,0.8 1,1h-2z";
    } else if (log_entry._source.api_method === "GET") {
      return "M1,1h-2v-2h2l-1,1z";
    } else if (log_entry._source.api_method === "PUT") {
      return "M1,1h-2v-2h2v0.6h-1v0.8h1z";
    } else if (log_entry._source.api_method === "PATCH") {
      return "M1,1h-2v-2h1.5q-0.5,0.5 0,1q0.5,0.5 0,1z";
    }
  }
};
detail_value_mutators.push(
  get_small_right_symbol_detail_mutator(function(d) { return d.key === "api_method"; }, right_symbol_pathstr_function)
);

var center_symbol_fill_function = function(log_entry) {
  return {
    "ERROR": "red",
    "WARNING": "orange",
    "DEBUG": "rgba(32,32,32,0.4)"
  }[log_entry._source.levelname];
};

var center_symbol_pathstr_function = function(log_entry) {
  return "M1.5,-1h1.5L-1.5,1h-1.5z";
};
detail_value_mutators.push(function(parameter_value) {
  parameter_value.filter(function(d) {
    return d.key == "levelname" && center_symbol_pathstr_function(d.log_entry) && center_symbol_fill_function(d.log_entry);
  }).select(".right-symbol")
    .attr("width", main_rect_width+2)
    .attr("height", main_rect_height+2)
    .select("path")
      .style("transform", "translate("
        + ((main_rect_width/2) + 1) + "px, "
        + ((main_rect_height/2) + 1) + "px) "
        + "scale("
        + main_rect_height/2 + ", "
        + main_rect_height/2 + ")"
      ).attr("d", function(d) { return center_symbol_pathstr_function(d.log_entry); })
      .attr("fill", function(d) { return center_symbol_fill_function(d.log_entry); });
});

var background_color_function = function(log_entry) {
  try {
    return d3.hsl(
      parseInt(log_entry._source.requestId.substr(-2), 16),
      0.5 + ((0.3 * parseInt(log_entry._source.requestId.substr(-3, 1), 16))/16),
      0.8
    ).toString();
  } catch (e) {}
};
detail_value_mutators.push(function(parameter_value) {
  var target_selection = parameter_value.filter(function(d) { return d.key === "requestId"; }).select(".value-text");
  target_selection.style("background-color", function(d) {
    return background_color_function(d.log_entry);
  });
  highlight_data_on_mouseover(target_selection, function(log_entry, d) { return log_entry._source.requestId === d.value });
});

detail_value_mutators.push(
  function(parameter_value) {
    highlight_data_on_mouseover(
      parameter_value.filter(function(d) { return ["spanId", "childSpanId"].includes(d.key); }).select(".value-text"),
      function(log_entry, d) {
        // only highlight if the requestId also matches
        return log_entry._source.requestId === d.log_entry._source.requestId && log_entry._source.spanId === d.value;
      }
    );
  },
  function(parameter_value) {
    highlight_data_on_mouseover(
      parameter_value.filter(function(d) { return d.key === "parentSpanId"; }).select(".value-text"),
      function(log_entry, d) {
        // only highlight if the requestId also matches
        return log_entry._source.requestId === d.log_entry._source.requestId && log_entry._source.spanId === d.value;
      }
    );
    // TODO do something extra special to entries with childSpanId set to this value
  },
  function(parameter_value) {
    highlight_data_on_mouseover(
      parameter_value.filter(function(d) { return d.key === "instance_id"; }).select(".value-text"),
      function(log_entry, d) { return log_entry._source.instance_id === d.value }
    );
  },
  function(parameter_value) {
    highlight_data_on_mouseover(
      parameter_value.filter(function(d) { return d.key === "remoteHost"; }).select(".value-text"),
      function(log_entry, d) { return log_entry._source.remoteHost === d.value }
    );
  }
);

var log_entry_g_id_function = function (log_entry) {
  return "log-entry-" + log_entry._id;
};

var logentry_get_start_time = function (log_entry) {
  var duration = logentry_get_duration(log_entry);
  return duration && log_entry._timestamp_ms - duration;
};

var logentry_get_earliest_time = function (log_entry) {
  return logentry_get_start_time(log_entry) || log_entry._timestamp_ms;
};

var mk_x_scale = function(nested_data) {
  return d3.scaleOrdinal(nested_data.map(function(d, i) { return (i+0.5) * type_width; }))
  .domain(nested_data.map(function(d, i) { return d.key; }));
}

// convert an svg transform= attribute into an inline css style (mainly involves adding "px" where necessary)
var transform_to_style = function (selection) {
  selection.filter("[transform]").style("transform", function() {
    return this.attributes.transform.value.replace(/([0-9.])\s*\,/, "$1px,").replace(/([0-9.])\s*\)/, "$1px)");
  }).attr("transform", null);
};

// "snap to pixel"
var sp = function (value) {
  return Math.round(value+0.5) - 0.5;
}

var object_key_sort_key = function(item) {
  return item.key;
};
var object_key_comparator = comparator_from_sort_key(object_key_sort_key);

var data;
var data_by_type;
var data_multiple_request_ids;
var chart_margin = {top: 2, right: 0, bottom: 10, left: 32};
var legend_margin = {top: 0, right: 0, bottom: 0, left: 32};
var type_width = 96;
var get_inner_width = function() { return type_width * data_by_type.length };
var get_outer_width = function() { return get_inner_width() + chart_margin.left + chart_margin.right };
var chart_container_height = 500;
var chart_height = 500;
var get_inner_height = function() { return chart_height - (chart_margin.top + chart_margin.bottom) };
var preferred_duration_spacing = 6;
var main_rect_width = 32;
var main_rect_height = 8;

var y_scale = d3.scaleTime();
var y_axis = d3.axisLeft(y_scale);

var x_scale_inner;
var x_scale_outer;
var x_axis_inner;
var x_axis_outer;

var chart_container = d3.select(".chart-container");

var chart = d3.select(".chart");
var chart_inner = chart.append("g")
  .attr("class", "chart-inner");
var chart_x_axis = chart_inner.append("g")
  .attr("class", "axis x-axis");
var chart_y_axis = chart_inner.append("g")
  .attr("class", "axis y-axis");
var chart_data_area = chart_inner.append("g")
  .attr("class", "data-area");

var legend = d3.select(".legend");
var legend_inner = legend.append("g")
  .attr("class", "chart-inner");
var legend_x_axis = legend_inner.append("g")
  .attr("class", "axis x-axis");

var logentry_right_half = function(log_entry) {
  return x_scale_inner(log_entry._type) > get_inner_width()/2;
};

chart.on("wheel", function() {
  if (d3.event.ctrlKey) {
    d3.event.preventDefault();

    var deltaY_normalized = d3.event.deltaY * {
      "0": 0.02,  // unit is pixels
      "1": 1./3,  // unit is lines
      "2": 1      // unit is pages
                  // ^ of course, the above have no literal meaning when zooming, so we've just got to
                  // weight them approximately
    }[d3.event.deltaMode];

    chart_height = Math.min(Math.max(chart_container_height, chart_height * Math.pow(2, -deltaY_normalized)), chart_container_height*64);

    zoom_updated();
  }
});

var src_data_form = d3.select("#src-data-form")
  .on("submit", function() {
    d3.event.preventDefault();
    d3.select(this).dispatch("pseudosubmit");
  })
  // submit events dispatched as a result of an extension message don't seem to be
  // cancelable, or perhaps are operating in xray mode. either way, putting the update
  // logic in a submit handler makes it hard to trigger from certain contexts. so put
  // logic in "pseudosubmit" handler which can be triggered directly from these contexts.
  .on("pseudosubmit", function() {
    d3.event.preventDefault();
    var new_data = JSON.parse(this.elements["src-data-json"].value);
    if (!Array.isArray(new_data)) {
      new_data = [new_data];
    }
    data = new_data.map(results => results.hits.hits).reduce((a, b) => a.concat(b));
    data_updated();
  });

var highlights_updated = function () {
  var total_highlights = data_by_type.map(function(type_group) {
    return type_group.highlight.length;
  }).reduce(function(a, b) {
    return a + b;
  });
  chart.classed("multiple-highlights", total_highlights > 1);
  chart.classed("highlights", total_highlights > 0);

  var highlight_g = chart_data_area.selectAll("g.type-group").select(".highlight-container").selectAll("g.highlight").data(
    function(parent_datum) {
      return parent_datum.highlight;
    },
    function(log_entry) { return log_entry._id; }
  );
  // rather than delete the highlight let's keep it around as it may be needed again
  highlight_g.exit().style("display", "none");
  var highlight_g_enter = highlight_g.enter().append("g")
    .attr("class", "highlight")
    .on("mouseleave", function () {
      // this event is occasionally missed, leaving a stale highlight mirror around
      d3.select(this.parentNode).datum().highlight = [];
      highlights_updated();
    });
  highlight_g_enter.append("use")
    .attr("class", "highlight-mirror");

  var time_line_container_end_enter = highlight_g_enter.append("g")
    .attr("class", "time-line-container time-line-container-end");
  time_line_container_end_enter.append("line")
    .attr("class", "time-line")
    .attr("x1", -get_outer_width())
    .attr("x2", get_outer_width());
  time_line_container_end_enter.append("text")
    .attr("class", "timestamp timestamp-end")
    .attr("y", "1em");

  var time_line_container_start_enter = highlight_g_enter.append("g")
    .attr("class", "time-line-container time-line-container-start");
  time_line_container_start_enter.append("line")
    .attr("class", "time-line")
    .attr("x1", -get_outer_width())
    .attr("x2", get_outer_width());
  time_line_container_start_enter.append("text")
    .attr("class", "timestamp timestamp-start");


  highlight_g = highlight_g.merge(highlight_g_enter);
  highlight_g.style("display", "inline")
    .select("use").attr("href", function(log_entry) { return "#" + log_entry_g_id_function(log_entry); });

  highlight_g.select(".time-line-container-end").style("transform", function(log_entry) {
    return "translate(0, " + sp(y_scale(log_entry._timestamp_ms)) + "px)";
  });

  highlight_g.select(".time-line-container-start").style("transform", function(log_entry) {
    var start_time = logentry_get_start_time(log_entry);
    return start_time && "translate(0, " + sp(y_scale(start_time)) + "px)";
  }).style("display", function(log_entry) {
    return logentry_get_start_time(log_entry) ? null : "none";
  });

  highlight_g.selectAll(".timestamp")
    .style("transform", function (log_entry) {
      return "translate(" + ((logentry_right_half(log_entry) ? -1 : 1) * main_rect_width) + "px, 0)";
    })
    .classed("right-half", logentry_right_half);

  highlight_g.select(".timestamp-start")
    .text(function (log_entry) {
      return new Date(logentry_get_start_time(log_entry)).toISOString();
    });
  highlight_g.select(".timestamp-end")
    .text(function (log_entry) {
      return new Date(log_entry._timestamp_ms).toISOString();
    });

  // only put the "start" timestamp below the timeline if we think we've got enough space between the two timelines
  highlight_g.select(".timestamp-start").attr("y", function (log_entry) {
    var start_time = logentry_get_start_time(log_entry);
    return start_time && sp(y_scale(log_entry._timestamp_ms)) - sp(y_scale(start_time)) < 20 ? "-0.3em" : "1em";
  });
};

var data_updated = function () {
  data_multiple_request_ids = !data.every(function (log_entry) {
    return log_entry._source.requestId === data[0]._source.requestId;
  });
  data.forEach(function (log_entry) {
    log_entry["_timestamp_ms"] = (new Date(log_entry._source["@timestamp"])).getTime();
  });
  data.sort(function(a, b) {
    return b._timestamp_ms - a._timestamp_ms;
  });
  data_by_type = d3.nest().key(function(log_entry) { return log_entry._type; }).entries(data);
  data_by_type.forEach(function (type_group) {
    type_group.highlight = [];
  });
  data_by_type.sort(type_sort_comparator);

  y_scale.domain([
    d3.min(data, function(log_entry) { return logentry_get_earliest_time(log_entry)}),
    d3.max(data, function(log_entry) { return log_entry._timestamp_ms})
  ]);
  y_axis.tickSize(-get_inner_width());
  // it doesn't look like a scale can be shared between two axis - if you do, drawing one axis affects the other, so
  // we have two "identical" x scales here
  x_scale_inner = mk_x_scale(data_by_type);
  x_scale_outer = mk_x_scale(data_by_type);
  x_axis_inner = d3.axisTop(x_scale_inner);
  x_axis_outer = d3.axisTop(x_scale_outer).tickSize(0);

  chart_container.style("height", chart_container_height + "px")
    .style("width", get_outer_width() + "px");
  chart_inner.style("transform", "translate(" + chart_margin.left + "px, " + chart_margin.top + "px)");

  legend.attr("width", get_outer_width())
    .attr("height", 32);
  legend_inner.style("transform", "translate(" + legend_margin.left + "px, " + 32 + "px)");

  var type_group_g = chart_data_area.selectAll("g.type-group").data(data_by_type, function(type_group) { return type_group.key; });
  var type_group_g_enter = type_group_g.enter().append("g")
    .attr("class", "type-group");
  type_group_g_enter.append("g")
      .attr("class", "log-entry-container");
  type_group_g_enter.append("g")
      .attr("class", "highlight-container")
      // only apply filter to highlights if we know we're not firefox - it has a rendering bug
      // causing the entire highlight to be invisible if filtered. only firefox has window.sidebar
      // defined
      .style("filter", window.sidebar ? "none" : "url(#halo)");
  type_group_g.exit().remove();

  var log_entry_g = chart_data_area.selectAll("g.type-group").select(".log-entry-container").selectAll("g.log-entry").data(
    function(parent_datum) {
      parent_datum.values.forEach(function(log_entry, i) { log_entry._order_in_type = i; });
      return parent_datum.values;
    },
    function(log_entry) { return log_entry._id; }
  );
  var log_entry_g_enter = log_entry_g.enter().append("g")
    .attr("class", "log-entry")
    .attr("id", log_entry_g_id_function)
    .on("mouseover", function() {
      // for now, we're only showing one highlight at a time, so clear all others that might still be showing
      data_by_type.forEach(function (type_group) {
        type_group.highlight = [];
      });

      var d = d3.select(this).datum();

      d3.select(this.parentNode).datum().highlight = [d];
      highlights_updated();

      var type_group_matcher = d3.matcher(".type-group");
      var type_group_candidate = this;
      for (; !type_group_matcher.apply(type_group_candidate); type_group_candidate = type_group_candidate.parentNode) {};
      type_group_candidate.parentNode.appendChild(type_group_candidate);

      var detail = d3.select("#visualization").selectAll("pre.detail").data(
        [d],
        function(log_entry) { return log_entry._id; }
      );
      var detail_enter = detail.enter().append("pre").attr("class", "detail");
      detail.exit().remove();
      detail = detail_enter.merge(detail);

      var datum_entries = d3.entries(d._source);
      datum_entries.forEach(function(entry) { entry.log_entry = d; });
      datum_entries.sort(object_key_comparator);
      var parameter_row = detail.selectAll(".parameter-row").data(datum_entries);
      var parameter_row_enter = parameter_row.enter().append("div").attr("class", "parameter-row");
      parameter_row_enter.append("span").attr("class", "parameter-key").text(function(d) { return d.key + ": "; });
      var parameter_row_value_enter = parameter_row_enter.append("span").attr("class", "parameter-value");
      parameter_row_value_enter.append("a")
        .attr("class", "value-text")
        .text(function(d) { return d.value; });
      parameter_row_value_enter.append("svg")
        .attr("width", "0")
        .attr("height", "0")
        .attr("class", "right-symbol")
        .append("path");
      parameter_row.exit().remove();
      parameter_row = parameter_row_enter.merge(parameter_row);

      detail_value_mutators.forEach(function(mutator) {
        mutator(parameter_row.select(".parameter-value"));
      });
    })
  log_entry_g.exit().remove();
  // set this back to the combined group
  log_entry_g = log_entry_g.merge(log_entry_g_enter);

  var duration_g_enter = log_entry_g_enter.append("g").attr("class", "duration");
  duration_g_enter.append("line")
    .attr("class", "duration-h")
    .attr("x1", -4)
    .attr("y1", 0)
    .attr("x2", 4)
    .attr("y2", 0);
  duration_g_enter.append("line")
    .attr("class", "duration-v")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", 0)
    .attr("y2", 1);  // actual height will end up getting defined by a transform because that's transitionable

  log_entry_g_enter.append("rect").attr("class", "main-rect-fill")
    .attr("x", -main_rect_width/2)
    .attr("y", 0)
    .attr("width", main_rect_width)
    .attr("height", main_rect_height);
  log_entry_g_enter.append("path").attr("class", "left-symbol")
    .style("transform", "translate("
      + (-(main_rect_width)/2) + "px, "
      + (main_rect_height/2) + "px) scale("
      + ((main_rect_height/2)+0.5)
      + ", " + ((main_rect_height/2)+0.5) + ")"
    );
  log_entry_g_enter.append("path").attr("class", "right-symbol")
    .style("transform", "translate("
      + ((main_rect_width)/2) + "px, "
      + (main_rect_height/2) + "px) scale("
      + ((main_rect_height+1)/2) + ", "
      + ((main_rect_height+1)/2) + ")"
    );
  log_entry_g_enter.append("path").attr("class", "main-rect-stroke")
    .attr("d", "M" + -((main_rect_width-(main_rect_height+1))/2) + ",0h" + (main_rect_width-(main_rect_height+1)) + "M" + -((main_rect_width-(main_rect_height+1))/2) + "," + main_rect_height + "h" + (main_rect_width-(main_rect_height+1)));
  var fallback_path_d = "M" + ((main_rect_width-(main_rect_height+1))/2) + ",0H" + main_rect_width/2 + "v" + main_rect_height + "H" + ((main_rect_width-(main_rect_height+1))/2);
  log_entry_g_enter.append("path").attr("class", "main-rect-stroke symbol-fallback left-symbol-fallback")
    .style("transform", "scale(-1,1)")
    .attr("d", fallback_path_d);
  log_entry_g_enter.append("path").attr("class", "main-rect-stroke symbol-fallback right-symbol-fallback")
    .attr("d", fallback_path_d);
  log_entry_g_enter.append("path").attr("class", "center-symbol")
    .style("transform", "translate(0, "
      + (main_rect_height/2) + "px) scale("
      + (main_rect_height/2)
      + ", " + (main_rect_height/2) + ")"
    );

  log_entry_g.select(".main-rect-fill")
    .style("fill", function(d) {
      if (data_multiple_request_ids) {
        return background_color_function(d);
      }
      return null;
    });
  log_entry_g.select(".left-symbol")
    .attr("fill", left_symbol_fill_function)
    .attr("d", left_symbol_pathstr_function)
    .style("display", function(log_entry) {
      return left_symbol_fill_function(log_entry) && left_symbol_pathstr_function(log_entry) ? null : "none";
    });
  log_entry_g.select(".right-symbol")
    .attr("fill", right_symbol_fill_function)
    .attr("d", right_symbol_pathstr_function)
    .style("display", function(log_entry) {
      return right_symbol_fill_function(log_entry) && right_symbol_pathstr_function(log_entry) ? null : "none";
    });
  log_entry_g.select(".left-symbol-fallback")
    .style("display", function(log_entry) {
      return left_symbol_fill_function(log_entry) && left_symbol_pathstr_function(log_entry) ? "none" : null;
    });
  log_entry_g.select(".right-symbol-fallback")
    .style("display", function(log_entry) {
      return right_symbol_fill_function(log_entry) && right_symbol_pathstr_function(log_entry) ? "none" : null;
    });
  log_entry_g.select(".center-symbol")
    .attr("fill", center_symbol_fill_function)
    .attr("d", center_symbol_pathstr_function)
    .style("display", function(log_entry) {
      return center_symbol_fill_function(log_entry) && center_symbol_pathstr_function(log_entry) ? null : "none";
    });

  zoom_updated();
};

var zoom_updated = function (type_line_g, log_entry_g) {
  var type_line_g = type_line_g || chart_data_area.selectAll("g.type-group");
  // remembering to do this nested select to get our grouping behaviour
  var log_entry_g = log_entry_g || chart_data_area.selectAll("g.type-group").selectAll("g.log-entry");

  chart.attr("width", get_outer_width());
  // we only want to set the new height before the scroll calculation if it's *greater than* the
  // existing height. the scroll calculation needs all the headroom available to it
  chart.attr("height", Math.max(chart_height, parseInt(chart.attr("height")) || 0));

  var y_original_range = y_scale.range();
  var y_original_range_upper = y_original_range && y_original_range[1];
  var original_scrollTop = chart_container.node().scrollTop;
  if (y_original_range_upper !== get_inner_height()) {
    var fixed_point_px;
    try {
      fixed_point_px = d3.mouse(chart_container.node())[1];
    } catch (e) {
      fixed_point_px = chart_container_height/2;
    }
    var fixed_point_ts = y_scale.invert(original_scrollTop + fixed_point_px - chart_margin.top);

    y_scale.range([0, get_inner_height()]);

    chart_container.node().scrollTop = y_scale(fixed_point_ts) + chart_margin.top - fixed_point_px;
  }
  var scrollTop_delta = chart_container.node().scrollTop - original_scrollTop;

  // now make sure our height is ultimately set to the desired value
  chart.attr("height", chart_height);

  y_axis.ticks(chart_height/50);
  x_axis_inner.tickSize(-get_inner_height());

  chart_x_axis.call(x_axis_inner);
  transform_to_style(chart_x_axis.selectAll(".tick"));
  legend_x_axis.call(x_axis_outer);
  transform_to_style(legend_x_axis.selectAll(".tick"));
  chart_y_axis.call(y_axis);
  transform_to_style(chart_y_axis.selectAll(".tick"));

  type_line_g.style("transform", function(d) { return "translate(" + x_scale_inner(d.key) + "px, 0px)"; });

  if (scrollTop_delta) {
    // the calculation and setting of the new scrollTop value will have moved the log_entry_g's positions
    // up or down the page. however we need the elements to appear to move from their previous position
    // *on screen* to the new one to make the animation appear correct. so before we allow the transition
    // to take place, we need to move log_entry_g's to a scrollTop-compensated position to get them back in
    // their previous screen position.
    // first we need to disable the transition because we want this move to happen invisibly (preferably don't
    // want the uncompensated position to be rendered at all)
    log_entry_g.style("transition", "none");
    // now add the compensation
    log_entry_g.style("transform", function(d, i, nodes) {
      return "translate(0px, " + ((this._seqdia_y_translation || 0) + scrollTop_delta) + "px)";
    });
    // trick layout into being recalculated for these elements before we give them back their transition
    log_entry_g.each(function () { window.getComputedStyle(this).transform });
    // allow transition to return to its stylesheet-set value
    log_entry_g.style("transition", null);
  }

  log_entry_g.style("transform", function(d, i, nodes) {
    // make a easily readable memo of the current set value (parsing it back out from a translate() string
    // is painful...)
    this._seqdia_y_translation = sp(y_scale(d._timestamp_ms));
    return "translate(0px, " + this._seqdia_y_translation + "px)"; }
  );
  log_entry_g.select(".duration")
    .style("display", function(d) { return logentry_get_duration(d) ? "inline" : "none"; })
    .filter(function(d) { return logentry_get_duration(d); })
      .style("transform", function(d, i, nodes) {
        return "translate(" + (
          (Math.ceil((nodes.length-1)/2) - i) * Math.min(main_rect_width/nodes.length, preferred_duration_spacing)
        ) + "px, " + (y_scale(logentry_get_start_time(d)) - y_scale(d._timestamp_ms)) + "px)";
      })
      .select(".duration-v")
        .style("transform", function(d) {
          return "scale(1, " + (y_scale(d._timestamp_ms) - y_scale(logentry_get_start_time(d))) + ")";
        });

  highlights_updated();
};

if (window.browser || (window.chrome && window.chrome.runtime && window.chrome.runtime.id)) {
  // we're running as an extension and should listen for messages (once we've included the browser polyfill)
  var s = document.createElement('script');
  s.src = "browser-polyfill.js";
  s.onload = function() {
    browser.runtime.onMessage.addListener(request => {
      if (request && request.setSrcDataJson) {
        src_data_form.node().elements["src-data-json"].value = request.setSrcDataJson;
        // actual submit events generated in this context don't appear to be cancelable
        src_data_form.dispatch("pseudosubmit");
        return Promise.resolve({response: "srcDataJsonSet"});
      }
    });
  };
  (document.head || document.documentElement).appendChild(s);
}
