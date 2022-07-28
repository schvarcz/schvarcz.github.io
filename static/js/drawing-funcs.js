function StackedAreaChart(data, {
    x = ([x]) => x, // given d in data, returns the (ordinal) x-value
    y = ([, y]) => y, // given d in data, returns the (quantitative) y-value
    z = () => 1, // given d in data, returns the (categorical) z-value
    title, // given d in data, returns the title
    marginTop = 20, // top margin, in pixels
    marginRight = 30, // right margin, in pixels
    marginBottom = 30, // bottom margin, in pixels
    marginLeft = 40, // left margin, in pixels
    width = 640, // outer width, in pixels
    height = 400, // outer height, in pixels
    xType = d3.scaleUtc, // type of x-scale
    xDomain, // [xmin, xmax]
    xRange = [marginLeft, width - marginRight], // [left, right]
    yType = d3.scaleLinear, // type of y-scale
    yDomain, // [ymin, ymax]
    yRange = [height - marginBottom, marginTop], // [bottom, top]
    zDomain, // array of z-values
    offset = d3.stackOffsetDiverging, // stack offset method
    order = d3.stackOrderNone, // stack order method
    xFormat, // a format specifier string for the x-axis
    yFormat = "f", // a format specifier for the y-axis
    yLabel, // a label for the y-axis
    colors = d3.schemeTableau10, // array of colors for z
} = {}) {
    // Compute values.
    const X = d3.map(data, x);
    // const Y = d3.map(data, y);
    // const Z = d3.map(data, z);
    const O = d3.map(data, d => d);

    // Compute default x- and z-domains, and unique the z-domain.
    if (xDomain === undefined) xDomain = d3.extent(X);
    if (zDomain === undefined) zDomain = Object.keys(data[0]);
    // zDomain = new d3.InternSet(zDomain);

    // Omit any data not present in the z-domain.
    const I = d3.range(X.length);

    // Compute a nested array of series where each series is [[y1, y2], [y1, y2],
    // [y1, y2], …] representing the y-extent of each stacked rect. In addition,
    // each tuple has an i (index) property so that we can refer back to the
    // original data point (data[i]). This code assumes that there is only one
    // data point for a given unique x- and z-value.
    const series = d3.stack()
        .keys(zDomain)
        .value((obj, key) => obj[key])
        .order(order)
        .offset(offset)
        (data);

    // Compute the default y-domain. Note: diverging stacks can be negative.
    if (yDomain === undefined) yDomain = d3.extent(series.flat(2));

    // Construct scales and axes.
    const xScale = xType(xDomain, xRange);
    const yScale = yType(yDomain, yRange);
    const color = d3.scaleOrdinal(zDomain, colors);
    const xAxis = d3.axisBottom(xScale).ticks(width / 80, xFormat).tickSizeOuter(0);
    const yAxis = d3.axisLeft(yScale).ticks(height / 50, yFormat);

    // Compute titles.
    if (title === undefined) {
        const formatDate = xScale.tickFormat(null, "%b %-d, %Y");
        const formatValue = yScale.tickFormat(100, ".2" + yFormat);
        title = i => zDomain.reduce((value, key, ii) => value + `${key}: ${formatValue(series[ii][i][1] - series[ii][i][0])}\n`, `${formatDate(X[i])}\n`) + `Total: ${formatValue(series.at(-1)[i][1])}`;
    } else {
        const T = title;
        title = i => T(O[i], i, data);
    }

    const area = d3.area()
        .x((d, i) => xScale(X[i]))
        .y0(([y1]) => yScale(y1))
        .y1(([, y2]) => yScale(y2));

    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto; height: intrinsic; overflow: visible;")
        .on("pointerenter pointermove", pointermoved)
        .on("pointerleave", pointerleft)
        .on("touchstart", event => event.preventDefault());

    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(yAxis)
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").clone()
            .attr("x2", width - marginLeft - marginRight)
            .attr("stroke-opacity", 0.1))
        .call(g => g.append("text")
            .attr("x", -marginLeft)
            .attr("y", 10)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .text(yLabel));

    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(xAxis)
        .call(g => g.selectAll(".tick line").clone()
            .attr("y2", marginTop + marginBottom - height)
            .attr("stroke-opacity", 0.1));

    svg.append("g")
        .selectAll("path")
        .data(series)
        .join("path")
        .attr("fill", (s, i) => color(zDomain[i]))
        .attr("d", area)
        .append("title")
        .text(s => s.key);

    const tooltip = svg.append("g")
        .style("pointer-events", "none");

    function pointermoved(event) {
        const i = d3.bisectCenter(X, xScale.invert(d3.pointer(event)[0]));

        if (!series.at(-1)[i][1])
            return pointerleft();
        tooltip.style("display", null);
        tooltip.attr("transform", `translate(${xScale(X[i])},${yScale(series.at(-1)[i][1])})`);

        const path = tooltip.selectAll("path")
            .data([,])
            .join("path")
            .attr("fill", "white")
            .attr("stroke", "black");

        const text = tooltip.selectAll("text")
            .data([,])
            .join("text")
            .call(text => text
                .selectAll("tspan")
                .data(`${title(i)}`.split(/\n/))
                .join("tspan")
                .attr("x", 0)
                .attr("y", (_, i) => `${i * 1.1}em`)
                .attr("font-weight", (_, i) => i ? null : "bold")
                .text(d => d));

        const { x, y, width: w, height: h } = text.node().getBBox();
        text.attr("transform", `translate(${-w / 2},${15 - y})`);
        path.attr("d", `M${-w / 2 - 10},5H-5l5,-5l5,5H${w / 2 + 10}v${h + 20}h-${w + 20}z`);
        svg.property("value", O[i]).dispatch("input", { bubbles: true });
    }

    function pointerleft() {
        tooltip.style("display", "none");
        svg.node().value = null;
        svg.dispatch("input", { bubbles: true });
    }
    legend = Swatches(color);
    console.log(typeof(legend));
    console.log(typeof(svg.node()));
    return [ legend, Object.assign(svg.node(), { scales: { color } }) ];
    return Object.assign(svg.node(), { scales: { color } });
}

function Scatterplot(data, {
    x = ([x]) => x, // given d in data, returns the (quantitative) x-value
    y = ([, y]) => y, // given d in data, returns the (quantitative) y-value
    r = 3, // (fixed) radius of dots, in pixels
    title, // given d in data, returns the title
    marginTop = 20, // top margin, in pixels
    marginRight = 30, // right margin, in pixels
    marginBottom = 30, // bottom margin, in pixels
    marginLeft = 40, // left margin, in pixels
    inset = r * 2, // inset the default range, in pixels
    insetTop = inset, // inset the default y-range
    insetRight = inset, // inset the default x-range
    insetBottom = inset, // inset the default y-range
    insetLeft = inset, // inset the default x-range
    width = 640, // outer width, in pixels
    height = 400, // outer height, in pixels
    xType = d3.scaleLinear, // type of x-scale
    xDomain, // [xmin, xmax]
    xRange = [marginLeft + insetLeft, width - marginRight - insetRight], // [left, right]
    yType = d3.scaleLinear, // type of y-scale
    yDomain, // [ymin, ymax]
    yRange = [height - marginBottom - insetBottom, marginTop + insetTop], // [bottom, top]
    xLabel, // a label for the x-axis
    yLabel, // a label for the y-axis
    xFormat, // a format specifier string for the x-axis
    yFormat, // a format specifier string for the y-axis
    fill = "none", // fill color for dots
    stroke = "currentColor", // stroke color for the dots
    strokeWidth = 1.5, // stroke width for dots
    halo = "#fff", // color of label halo 
    haloWidth = 3 // padding around the labels
} = {}) {
    // Compute values.
    const X = d3.map(data, x);
    const Y = d3.map(data, y);
    const T = title == null ? null : d3.map(data, title);
    const I = d3.range(X.length).filter(i => !isNaN(X[i]) && !isNaN(Y[i]));

    // Compute default domains.
    if (xDomain === undefined) xDomain = d3.extent(X);
    if (yDomain === undefined) yDomain = d3.extent(Y);

    // Construct scales and axes.
    const xScale = xType(xDomain, xRange);
    const yScale = yType(yDomain, yRange);
    const xAxis = d3.axisBottom(xScale).ticks(width / 80, xFormat);
    const yAxis = d3.axisLeft(yScale).ticks(height / 50, yFormat);

    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto; height: intrinsic; overflow: visible;");

    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(xAxis)
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").clone()
            .attr("y2", marginTop + marginBottom - height)
            .attr("stroke-opacity", 0.1))
        .call(g => g.append("text")
            .attr("x", width)
            .attr("y", marginBottom - 4)
            .attr("fill", "currentColor")
            .attr("text-anchor", "end")
            .text(xLabel));

    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(yAxis)
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").clone()
            .attr("x2", width - marginLeft - marginRight)
            .attr("stroke-opacity", 0.1))
        .call(g => g.append("text")
            .attr("x", -marginLeft)
            .attr("y", 10)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .text(yLabel));

    if (T) svg.append("g")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .selectAll("text")
        .data(I)
        .join("text")
        .attr("dx", 7)
        .attr("dy", "0.35em")
        .attr("x", i => xScale(X[i]))
        .attr("y", i => yScale(Y[i]))
        .text(i => T[i])
        .call(text => text.clone(true))
        .attr("fill", "none")
        .attr("stroke", halo)
        .attr("stroke-width", haloWidth);

    svg.append("g")
        .attr("fill", fill)
        .attr("stroke", stroke)
        .attr("stroke-width", strokeWidth)
        .selectAll("circle")
        .data(I)
        .join("circle")
        .attr("cx", i => xScale(X[i]))
        .attr("cy", i => yScale(Y[i]))
        .attr("r", r);

    return svg.node();
}

// Copyright 2021 Observable, Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/area-chart
function AreaChart(data, {
    x = ([x]) => x, // given d in data, returns the (temporal) x-value
    y = ([, y]) => y, // given d in data, returns the (quantitative) y-value
    title, // given d in data, returns the title text
    defined, // given d in data, returns true if defined (for gaps)
    curve = d3.curveLinear, // method of interpolation between points
    marginTop = 20, // top margin, in pixels
    marginRight = 30, // right margin, in pixels
    marginBottom = 30, // bottom margin, in pixels
    marginLeft = 40, // left margin, in pixels
    width = 640, // outer width, in pixels
    height = 400, // outer height, in pixels
    xType = d3.scaleUtc, // type of x-scale
    xDomain, // [xmin, xmax]
    xRange = [marginLeft, width - marginRight], // [left, right]
    yType = d3.scaleLinear, // type of y-scale
    yDomain, // [ymin, ymax]
    yRange = [height - marginBottom, marginTop], // [bottom, top]
    yFormat, // a format specifier string for the y-axis
    yLabel, // a label for the y-axis
    color = "currentColor" // fill color of area
} = {}) {
    // Compute values.
    const X = d3.map(data, x);
    const Y = d3.map(data, y);
    const I = d3.range(X.length);
    const O = d3.map(data, d => d);

    // Compute which data points are considered defined.
    if (defined === undefined) defined = (d, i) => !isNaN(X[i]) && !isNaN(Y[i]);
    const D = d3.map(data, defined);

    // Compute default domains.
    if (xDomain === undefined) xDomain = d3.extent(X);
    if (yDomain === undefined) yDomain = [0, d3.max(Y)];

    // Construct scales and axes.
    const xScale = xType(xDomain, xRange);
    const yScale = yType(yDomain, yRange);
    const xAxis = d3.axisBottom(xScale).ticks(width / 80).tickSizeOuter(0);
    const yAxis = d3.axisLeft(yScale).ticks(height / 40, yFormat);

    // Compute titles.
    if (title === undefined) {
        const formatDate = xScale.tickFormat(null, "%b %-d, %Y");
        const formatValue = yScale.tickFormat(100, yFormat);
        title = i => `${formatDate(X[i])}\n${formatValue(Y[i])}`;
    } else {
        const T = title;
        title = i => T(O[i], i, data);
    }

    // Construct an area generator.
    const area = d3.area()
        .defined(i => D[i])
        .curve(curve)
        .x(i => xScale(X[i]))
        .y0(yScale(0))
        .y1(i => yScale(Y[i]));

    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto; height: intrinsic; overflow: visible;")
        .on("pointerenter pointermove", pointermoved)
        .on("pointerleave", pointerleft)
        .on("touchstart", event => event.preventDefault());

    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(yAxis)
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").clone()
            .attr("x2", width - marginLeft - marginRight)
            .attr("stroke-opacity", 0.1))
        .call(g => g.append("text")
            .attr("x", -marginLeft)
            .attr("y", 10)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .text(yLabel));

    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(xAxis)
        .call(g => g.selectAll(".tick line").clone()
            .attr("y2", marginTop + marginBottom - height)
            .attr("stroke-opacity", 0.1));

    svg.append("path")
        .attr("fill", color)
        .attr("d", area(I));


    const tooltip = svg.append("g")
        .style("pointer-events", "none");
    function pointermoved(event) {
        const i = d3.bisectCenter(X, xScale.invert(d3.pointer(event)[0]));
        tooltip.style("display", null);
        tooltip.attr("transform", `translate(${xScale(X[i])},${yScale(Y[i])})`);

        const path = tooltip.selectAll("path")
            .data([,])
            .join("path")
            .attr("fill", "white")
            .attr("stroke", "black");

        const text = tooltip.selectAll("text")
            .data([,])
            .join("text")
            .call(text => text
                .selectAll("tspan")
                .data(`${title(i)}`.split(/\n/))
                .join("tspan")
                .attr("x", 0)
                .attr("y", (_, i) => `${i * 1.1}em`)
                .attr("font-weight", (_, i) => i ? null : "bold")
                .text(d => d));

        const { x, y, width: w, height: h } = text.node().getBBox();
        text.attr("transform", `translate(${-w / 2},${15 - y})`);
        path.attr("d", `M${-w / 2 - 10},5H-5l5,-5l5,5H${w / 2 + 10}v${h + 20}h-${w + 20}z`);
        svg.property("value", O[i]).dispatch("input", { bubbles: true });
    }

    function pointerleft() {
        tooltip.style("display", "none");
        svg.node().value = null;
        svg.dispatch("input", { bubbles: true });
    }


    return svg.node();
}

function DifferenceChart(data, {
    x = ([x]) => x, // given d in data, returns the (temporal) x-value
    y1 = () => 0, // given d in data, returns the (quantitative) baseline y-value
    y2 = ([, y]) => y, // given d in data, returns the (quantitative) y-value
    title, // given d in data, returns the title text
    defined, // for gaps in data
    curve = d3.curveLinear, // curve generator for the lines
    marginTop = 20, // top margin, in pixels
    marginRight = 30, // right margin, in pixels
    marginBottom = 30, // bottom margin, in pixels
    marginLeft = 40, // left margin, in pixels
    width = 640, // outer width, in pixels
    height = 400, // outer height, in pixels
    xType = d3.scaleUtc, // type of x-scale
    xDomain, // [xmin, xmax]
    xRange = [marginLeft, width - marginRight], // [left, right]
    yType = d3.scaleLinear, // type of y-scale
    yDomain, // [ymin, ymax]
    yRange = [height - marginBottom, marginTop], // [bottom, top]
    yFormat, // a format specifier string for the y-axis
    yLabel, // a label for the y-axis
    colors = d3.reverse(d3.schemeGreens[3]), // colors for negative and positive differences
    stroke = "currentColor", // stroke color of line
    strokeLinecap = "round", // stroke line cap of the line
    strokeLinejoin = "round", // stroke line join of the line
    strokeWidth = 1.5, // stroke width of line, in pixels
    strokeOpacity = 1, // stroke opacity of line
} = {}) {
    // Compute values.
    const X = d3.map(data, x);
    const Y1 = d3.map(data, y1);
    const Y2 = d3.map(data, y2);
    const I = d3.range(data.length);
    const O = d3.map(data, d => d);
    if (defined === undefined) defined = (d, i) => !isNaN(X[i]) && !isNaN(Y1[i]) && !isNaN(Y2[i]);
    const D = d3.map(data, defined);

    // Compute default domains.
    if (xDomain === undefined) xDomain = d3.extent(X);
    if (yDomain === undefined) yDomain = d3.extent([...Y1, ...Y2]);

    // Construct scales and axes.
    const xScale = xType(xDomain, xRange);
    const yScale = yType(yDomain, yRange);
    const xAxis = d3.axisBottom(xScale).ticks(width / 80).tickSizeOuter(0);
    const yAxis = d3.axisLeft(yScale).ticks(height / 60, yFormat);

    // Compute titles.
    if (title === undefined) {
        const formatDate = xScale.tickFormat(null, "%b %-d, %Y");
        const formatValue = yScale.tickFormat(100, yFormat);
        title = i => `${formatDate(X[i])}\n${formatValue(Y2[i])} - ${formatValue(Y1[i])} = ${formatValue(Y2[i] - Y1[i])}`;
    } else {
        const T = title;
        title = i => T(O[i], i, data);
    }

    // A unique identifier for clip paths (to avoid conflicts).
    const uid = `O-${Math.random().toString(16).slice(2)}`;

    // Helpers for rendering lines and areas.
    const line = (y) => d3.line().defined(i => D[i]).curve(curve).x(i => xScale(X[i])).y(y)(I);
    const area = (y0, y1) => d3.area().defined(i => D[i]).curve(curve).x(i => xScale(X[i])).y0(y0).y1(y1)(I);

    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto; height: intrinsic; overflow: visible;")
        .on("pointerenter pointermove", pointermoved)
        .on("pointerleave", pointerleft)
        .on("touchstart", event => event.preventDefault());

    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(yAxis)
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").clone()
            .attr("x2", width - marginLeft - marginRight)
            .attr("stroke-opacity", 0.1))
        .call(g => g.append("text")
            .attr("x", -marginLeft)
            .attr("y", 10)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .text(yLabel));

    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(xAxis)
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").clone()
            .attr("y2", marginTop + marginBottom - height)
            .attr("stroke-opacity", 0.1));

    svg.append("clipPath")
        .attr("id", `${uid}-above`)
        .append("path")
        .attr("d", area(0, i => yScale(Y1[i])));

    svg.append("clipPath")
        .attr("id", `${uid}-below`)
        .append("path")
        .attr("d", area(height, i => yScale(Y1[i])));

    svg.append("path")
        .attr("clip-path", `url(${new URL(`#${uid}-above`, location)})`)
        .attr("fill", colors[colors.length - 1])
        .attr("d", area(height, i => yScale(Y2[i])));

    svg.append("path")
        .attr("clip-path", `url(${new URL(`#${uid}-below`, location)})`)
        .attr("fill", colors[0])
        .attr("d", area(0, i => yScale(Y2[i])));

    svg.append("path")
        .attr("fill", "none")
        .attr("stroke", stroke)
        .attr("stroke-width", strokeWidth)
        .attr("stroke-linecap", strokeLinecap)
        .attr("stroke-linejoin", strokeLinejoin)
        .attr("stroke-opacity", strokeOpacity)
        .attr("d", line(i => yScale(Y2[i])));

    const tooltip = svg.append("g")
        .style("pointer-events", "none");

    function pointermoved(event) {
        const i = d3.bisectCenter(X, xScale.invert(d3.pointer(event)[0]));
        tooltip.style("display", null);
        tooltip.attr("transform", `translate(${xScale(X[i])},${yScale(Y2[i])})`);

        const path = tooltip.selectAll("path")
            .data([,])
            .join("path")
            .attr("fill", "white")
            .attr("stroke", "black");

        const text = tooltip.selectAll("text")
            .data([,])
            .join("text")
            .call(text => text
                .selectAll("tspan")
                .data(`${title(i)}`.split(/\n/))
                .join("tspan")
                .attr("x", 0)
                .attr("y", (_, i) => `${i * 1.1}em`)
                .attr("font-weight", (_, i) => i ? null : "bold")
                .text(d => d));

        const { x, y, width: w, height: h } = text.node().getBBox();
        text.attr("transform", `translate(${-w / 2},${15 - y})`);
        path.attr("d", `M${-w / 2 - 10},5H-5l5,-5l5,5H${w / 2 + 10}v${h + 20}h-${w + 20}z`);
        svg.property("value", O[i]).dispatch("input", { bubbles: true });
    }

    function pointerleft() {
        tooltip.style("display", "none");
        svg.node().value = null;
        svg.dispatch("input", { bubbles: true });
    }
    return svg.node();
}

// Copyright 2021 Observable, Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/line-with-tooltip
function LineChart(data, {
    x = ([x]) => x, // given d in data, returns the (temporal) x-value
    y = ([, y]) => y, // given d in data, returns the (quantitative) y-value
    title, // given d in data, returns the title text
    defined, // for gaps in data
    curve = d3.curveLinear, // method of interpolation between points
    marginTop = 20, // top margin, in pixels
    marginRight = 30, // right margin, in pixels
    marginBottom = 30, // bottom margin, in pixels
    marginLeft = 40, // left margin, in pixels
    width = 640, // outer width, in pixels
    height = 400, // outer height, in pixels
    xType = d3.scaleUtc, // type of x-scale
    xDomain, // [xmin, xmax]
    xRange = [marginLeft, width - marginRight], // [left, right]
    yType = d3.scaleLinear, // type of y-scale
    yDomain, // [ymin, ymax]
    yRange = [height - marginBottom, marginTop], // [bottom, top]
    color = "currentColor", // stroke color of line
    strokeWidth = 1.5, // stroke width of line, in pixels
    strokeLinejoin = "round", // stroke line join of line
    strokeLinecap = "round", // stroke line cap of line
    yFormat, // a format specifier string for the y-axis
    yLabel, // a label for the y-axis
} = {}) {
    // Compute values.
    const X = d3.map(data, x);
    const Y = d3.map(data, y);
    const O = d3.map(data, d => d);
    const I = d3.map(data, (_, i) => i);

    // Compute which data points are considered defined.
    if (defined === undefined) defined = (d, i) => !isNaN(X[i]) && !isNaN(Y[i]);
    const D = d3.map(data, defined);

    // Compute default domains.
    if (xDomain === undefined) xDomain = d3.extent(X);
    if (yDomain === undefined) yDomain = [0, d3.max(Y)];

    // Construct scales and axes.
    const xScale = xType(xDomain, xRange);
    const yScale = yType(yDomain, yRange);
    const xAxis = d3.axisBottomƒ(xScale).ticks(width / 80).tickSizeOuter(0);
    const yAxis = d3.axisLeft(yScale).ticks(height / 40, yFormat);

    // Compute titles.
    if (title === undefined) {
        const formatDate = xScale.tickFormat(null, "%b %-d, %Y");
        const formatValue = yScale.tickFormat(100, yFormat);
        title = i => `${formatDate(X[i])}\n${formatValue(Y[i])}`;
    } else {
        const T = title;
        title = i => T(O[i], i, data);
    }

    // Construct a line generator.
    const line = d3.line()
        .defined(i => D[i])
        .curve(curve)
        .x(i => xScale(X[i]))
        .y(i => yScale(Y[i]));

    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto; height: intrinsic; overflow: visible;")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10)
        .style("-webkit-tap-highlight-color", "transparent")
        .style("overflow", "visible")
        .on("pointerenter pointermove", pointermoved)
        .on("pointerleave", pointerleft)
        .on("touchstart", event => event.preventDefault());

    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(xAxis);

    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(yAxis)
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").clone()
            .attr("x2", width - marginLeft - marginRight)
            .attr("stroke-opacity", 0.1))
        .call(g => g.append("text")
            .attr("x", -marginLeft)
            .attr("y", 10)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .text(yLabel));

    svg.append("path")
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", strokeWidth)
        .attr("stroke-linejoin", strokeLinejoin)
        .attr("stroke-linecap", strokeLinecap)
        .attr("d", line(I));

    const tooltip = svg.append("g")
        .style("pointer-events", "none");

    function pointermoved(event) {
        const i = d3.bisectCenter(X, xScale.invert(d3.pointer(event)[0]));
        tooltip.style("display", null);
        tooltip.attr("transform", `translate(${xScale(X[i])},${yScale(Y[i])})`);

        const path = tooltip.selectAll("path")
            .data([,])
            .join("path")
            .attr("fill", "white")
            .attr("stroke", "black");

        const text = tooltip.selectAll("text")
            .data([,])
            .join("text")
            .call(text => text
                .selectAll("tspan")
                .data(`${title(i)}`.split(/\n/))
                .join("tspan")
                .attr("x", 0)
                .attr("y", (_, i) => `${i * 1.1}em`)
                .attr("font-weight", (_, i) => i ? null : "bold")
                .text(d => d));

        const { x, y, width: w, height: h } = text.node().getBBox();
        text.attr("transform", `translate(${-w / 2},${15 - y})`);
        path.attr("d", `M${-w / 2 - 10},5H-5l5,-5l5,5H${w / 2 + 10}v${h + 20}h-${w + 20}z`);
        svg.property("value", O[i]).dispatch("input", { bubbles: true });
    }

    function pointerleft() {
        tooltip.style("display", "none");
        svg.node().value = null;
        svg.dispatch("input", { bubbles: true });
    }

    return Object.assign(svg.node(), { value: null });
}

// Copyright 2021 Observable, Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/stacked-bar-chart
function StackedBarChart(data, {
    x = (d, i) => i, // given d in data, returns the (ordinal) x-value
    y = d => d, // given d in data, returns the (quantitative) y-value
    z = () => 1, // given d in data, returns the (categorical) z-value
    title, // given d in data, returns the title text
    marginTop = 30, // top margin, in pixels
    marginRight = 0, // right margin, in pixels
    marginBottom = 30, // bottom margin, in pixels
    marginLeft = 40, // left margin, in pixels
    width = 640, // outer width, in pixels
    height = 400, // outer height, in pixels
    xType = d3.scaleUtc, // type of x-scale
    xDomain, // array of x-values
    xRange = [marginLeft, width - marginRight], // [left, right]
    xPadding = 0.1, // amount of x-range to reserve to separate bars
    yType = d3.scaleLinear, // type of y-scale
    yDomain, // [ymin, ymax]
    yRange = [height - marginBottom, marginTop], // [bottom, top]
    zDomain, // array of z-values
    offset = d3.stackOffsetDiverging, // stack offset method
    order = d3.stackOrderNone, // stack order method
    yFormat = "f", // a format specifier string for the y-axis
    yLabel, // a label for the y-axis
    colors = d3.schemeTableau10, // array of colors
} = {}) {
    // Compute values.
    const X = d3.map(data, x);
    // const Y = d3.map(data, y);
    // const Z = d3.map(data, z);
    const O = d3.map(data, d => d);

    // Compute default x- and z-domains, and unique them.
    if (xDomain === undefined) xDomain = X;
    if (zDomain === undefined) zDomain = Object.keys(data[0]);
    xDomain = new d3.InternSet(xDomain);
    // zDomain = new d3.InternSet(zDomain);

    // Omit any data not present in the x- and z-domains.
    // const I = d3.range(X.length).filter(i => xDomain.has(X[i]) && zDomain.has(Z[i]));
    const I = d3.range(X.length);

    // Compute a nested array of series where each series is [[y1, y2], [y1, y2],
    // [y1, y2], …] representing the y-extent of each stacked rect. In addition,
    // each tuple has an i (index) property so that we can refer back to the
    // original data point (data[i]). This code assumes that there is only one
    // data point for a given unique x- and z-value.
    const series = d3.stack()
        .keys(zDomain)
        .value((obj, key) => obj[key])
        .order(order)
        .offset(offset)
        (data);

    // Compute the default y-domain. Note: diverging stacks can be negative.
    if (yDomain === undefined) yDomain = d3.extent(series.flat(2));

    // Construct scales, axes, and formats.
    const xScale = d3.scaleBand(xDomain, xRange).paddingInner(xPadding);
    const yScale = yType(yDomain, yRange);
    const color = d3.scaleOrdinal(zDomain, colors);
    const xAxis = d3.axisBottom(xScale).tickSizeOuter(0);
    const yAxis = d3.axisLeft(yScale).ticks(height / 60, yFormat);

    // Compute titles.
    if (title === undefined) {
        const formatDate = d3.scaleUtc().tickFormat(null, "%b %-d, %Y");
        const formatValue = yScale.tickFormat(X.length, ".2" + yFormat);
        title = i => zDomain.reduce((value, key, ii) => value + `${key}: ${formatValue(series[ii][i][1] - series[ii][i][0])}\n`, `${formatDate(O[i].Date)}\n`) + `Total: ${formatValue(series.at(-1)[i][1])}`;
    } else {
        const T = title;
        title = i => T(O[i], i, data);
    }

    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto; height: intrinsic; overflow: visible;")
        .on("pointerenter pointermove", pointermoved)
        .on("pointerleave", pointerleft)
        .on("touchstart", event => event.preventDefault());

    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(yAxis)
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").clone()
            .attr("x2", width - marginLeft - marginRight)
            .attr("stroke-opacity", 0.1))
        .call(g => g.append("text")
            .attr("x", -marginLeft)
            .attr("y", 10)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .text(yLabel));

    svg.append("g")
        .attr("transform", `translate(0,${yScale(0)})`)
        .call(xAxis)
        .call(g => g.selectAll(".tick line").clone()
            .attr("y2", marginTop + marginBottom - height)
            .attr("stroke-opacity", 0.1));

    const bar = svg.append("g")
        .selectAll("g")
        .data(series)
        .join("g")
        .attr("fill", (s, i) => color(zDomain[i]))
        .selectAll("rect")
        .data(d => d)
        .join("rect")
        .attr("x", (obj, i) => xScale(X[i]))
        .attr("y", ([y1, y2]) => Math.min(yScale(y1), yScale(y2)))
        .attr("height", ([y1, y2]) => Math.abs(yScale(y1) - yScale(y2)))
        .attr("width", xScale.bandwidth());

    const tooltip = svg.append("g")
        .style("pointer-events", "none");

    function pointermoved(event) {
        var xScalePointer = d3.scaleLinear([0, X.length], xRange);
        const i = d3.bisectCenter(d3.range(X.length), xScalePointer.invert(d3.pointer(event)[0]));

        if (!series.at(-1)[i][1])
            return pointerleft();
        tooltip.style("display", null);
        tooltip.attr("transform", `translate(${xScale(X[i]) + xScale.bandwidth() / 2},${yScale(series.at(-1)[i][1])})`);

        const path = tooltip.selectAll("path")
            .data([,])
            .join("path")
            .attr("fill", "white")
            .attr("stroke", "black");

        const text = tooltip.selectAll("text")
            .data([,])
            .join("text")
            .call(text => text
                .selectAll("tspan")
                .data(`${title(i)}`.split(/\n/))
                .join("tspan")
                .attr("x", 0)
                .attr("y", (_, i) => `${i * 1.1}em`)
                .attr("font-weight", (_, i) => i ? null : "bold")
                .text(d => d));

        const { x, y, width: w, height: h } = text.node().getBBox();
        text.attr("transform", `translate(${-w / 2},${15 - y})`);
        path.attr("d", `M${-w / 2 - 10},5H-5l5,-5l5,5H${w / 2 + 10}v${h + 20}h-${w + 20}z`);
        svg.property("value", O[i]).dispatch("input", { bubbles: true });
    }

    function pointerleft() {
        tooltip.style("display", "none");
        svg.node().value = null;
        svg.dispatch("input", { bubbles: true });
    }

    legend = Swatches(color);
    return [ legend, Object.assign(svg.node(), { scales: { color } }) ];
    // return Object.assign(svg.node(), { scales: { color } }) ;
}
// Copyright 2021 Observable, Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/bar-chart
function BarChart(data, {
    x = (d, i) => i, // given d in data, returns the (ordinal) x-value
    y = d => d, // given d in data, returns the (quantitative) y-value
    title, // given d in data, returns the title text
    marginTop = 20, // the top margin, in pixels
    marginRight = 0, // the right margin, in pixels
    marginBottom = 30, // the bottom margin, in pixels
    marginLeft = 40, // the left margin, in pixels
    width = 640, // the outer width of the chart, in pixels
    height = 400, // the outer height of the chart, in pixels
    xDomain, // an array of (ordinal) x-values
    xRange = [marginLeft, width - marginRight], // [left, right]
    yType = d3.scaleLinear, // y-scale type
    yDomain, // [ymin, ymax]
    yRange = [height - marginBottom, marginTop], // [bottom, top]
    xPadding = 0.1, // amount of x-range to reserve to separate bars
    yFormat, // a format specifier string for the y-axis
    yLabel, // a label for the y-axis
    color = "currentColor" // bar fill color
} = {}) {
    // Compute values.
    const X = d3.map(data, x);
    const Y = d3.map(data, y);

    // Compute default domains, and unique the x-domain.
    if (xDomain === undefined) xDomain = X;
    if (yDomain === undefined) yDomain = [0, d3.max(Y)];
    xDomain = new d3.InternSet(xDomain);

    // Omit any data not present in the x-domain.
    const I = d3.range(X.length).filter(i => xDomain.has(X[i]));

    // Construct scales, axes, and formats.
    const xScale = d3.scaleBand(xDomain, xRange).padding(xPadding);
    const yScale = yType(yDomain, yRange);
    const xAxis = d3.axisBottom(xScale).tickSizeOuter(0);
    const yAxis = d3.axisLeft(yScale).ticks(height / 40, yFormat);

    // Compute titles.
    if (title === undefined) {
        const formatValue = yScale.tickFormat(100, yFormat);
        title = i => `${X[i]}\n${formatValue(Y[i])}`;
    } else {
        const O = d3.map(data, d => d);
        const T = title;
        title = i => T(O[i], i, data);
    }

    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto; height: intrinsic; overflow: visible;");

    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(yAxis)
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").clone()
            .attr("x2", width - marginLeft - marginRight)
            .attr("stroke-opacity", 0.1))
        .call(g => g.append("text")
            .attr("x", -marginLeft)
            .attr("y", 10)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .text(yLabel));

    const bar = svg.append("g")
        .attr("fill", color)
        .selectAll("rect")
        .data(I)
        .join("rect")
        .attr("x", i => xScale(X[i]))
        .attr("y", i => yScale(Y[i]))
        .attr("height", i => yScale(0) - yScale(Y[i]))
        .attr("width", xScale.bandwidth());

    if (title) bar.append("title")
        .text(title);

    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(xAxis);

    return svg.node();
}

// Copyright 2021, Observable Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/color-legend
function Swatches(color, {
    columns = null,
    format,
    unknown: formatUnknown,
    swatchSize = 15,
    swatchWidth = swatchSize,
    swatchHeight = swatchSize,
    marginLeft = 40
} = {}) {
    const id = `-swatches-${Math.random().toString(16).slice(2)}`;
    const unknown = formatUnknown == null ? undefined : color.unknown();
    const unknowns = unknown == null || unknown === d3.scaleImplicit ? [] : [unknown];
    const domain = color.domain().concat(unknowns);
    if (format === undefined) format = x => x === unknown ? formatUnknown : x;

    function entity(character) {
        return `&#${character.charCodeAt(0).toString()};`;
    }

    if (columns !== null) return htl.html`<div style="display: flex; align-items: center; margin-left: ${+marginLeft}px; min-height: 33px; font: 10px sans-serif;">
    <style>
  
  .${id}-item {
    break-inside: avoid;
    display: flex;
    align-items: center;
    padding-bottom: 1px;
  }
  
  .${id}-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: calc(100% - ${+swatchWidth}px - 0.5em);
  }
  
  .${id}-swatch {
    width: ${+swatchWidth}px;
    height: ${+swatchHeight}px;
    margin: 0 0.5em 0 0;
  }
  
    </style>
    <div style=${{ width: "100%", columns }}>${domain.map(value => {
        const label = `${format(value)}`;
        return htl.html`<div class=${id}-item>
        <div class=${id}-swatch style=${{ background: color(value) }}></div>
        <div class=${id}-label title=${label}>${label}</div>
      </div>`;
    })}
    </div>
  </div>`;

    return htl.html`<div style="display: flex; align-items: center; min-height: 33px; margin-left: ${+marginLeft}px; font: 10px sans-serif;">
    <style>
  
  .${id} {
    display: inline-flex;
    align-items: center;
    margin-right: 1em;
  }
  
  .${id}::before {
    content: "";
    width: ${+swatchWidth}px;
    height: ${+swatchHeight}px;
    margin-right: 0.5em;
    background: var(--color);
  }
  
    </style>
    <div>${domain.map(value => htl.html`<span class="${id}" style="--color: ${color(value)}">${format(value)}</span>`)}</div>`;
}

