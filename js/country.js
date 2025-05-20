// 事件监听
document.getElementById("data-type").addEventListener("change", updateMap);
document.getElementById("year").addEventListener("change", updateMap);

// 获取参数
const params = new URLSearchParams(window.location.search);
const code = params.get("code");

// 构建路径
const jsonPath = `data/countries/${code}.json`;

let projection = d3.geoMercator();
let mapDataGlobal = null; // 存储地图数据
let svgMap = d3.select("#map");
let svgLegend = d3.select("#legend");
let unit = "";

// 初始化，加载地图数据
d3.json(jsonPath).then(mapData => {
    mapDataGlobal = mapData;
    updateMap(); // 初次加载地图和默认数据
});

// 获取选择值并加载对应 CSV 文件
function updateMap() {
    const type = document.getElementById("data-type").value;
    const year = document.getElementById("year").value;
    const csvPath = `data/countries/${code}-${type}.csv`;

    d3.csv(csvPath).then(data => {
        const dataMap = new Map();
        data.forEach(d => {
            const region = d["region"];
            const value = +d[`${year}`];
            dataMap.set(region, value);
        });

        // 获取单位 
        unit = data[0]["unit"];

        // 绘制地图
        drawChoropleth(mapDataGlobal, dataMap);
    });
}

// 主绘图逻辑
function drawChoropleth(mapData, dataMap) {
    svgMap.selectAll("*").remove(); // 清除原图
    svgLegend.selectAll("*").remove();

    const width = +svgMap.attr("width");
    const height = +svgMap.attr("height");

    // 设置投影
    const cities = topojson.feature(mapData, mapData.objects.cities);
    //projection.fitSize([width, height], cities);
    setProjection(width, height, cities);
    const path = d3.geoPath().projection(projection);

    const values = Array.from(dataMap.values());
    const min = d3.quantile(values, 0.1);  // 下边5%
    const max = d3.quantile(values, 0.9);  // 上边5%

    // 颜色映射
    const color = d3.scaleQuantize()
        .domain([min, max])
        .range(d3.schemeBlues[9]);

    svgMap.append("g")
        .attr("class", "regions")
        .selectAll("path")
        .data(cities.features)
        .enter()
        .append("path")
        .attr("fill", d => {
            const name = d.properties["cityName"];
            const value = dataMap.get(name);
            return value != null ? color(value) : "#ccc";
        })
        .attr("d", path)
        .append("title")
        .text(d => {
            const name = d.properties["cityName"];
            const value = dataMap.get(name);
            return name + (value != null ? ": " + value : "（无数据）");
        });

    svgMap.append("path")
        .datum(topojson.mesh(mapData, mapData.objects.cities, (a, b) => a !== b))
        .attr("class", "cities")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 0.5);

    svgMap.append("path")
        .datum(topojson.mesh(mapData, mapData.objects.cities, (a, b) => a === b))
        .attr("class", "outline")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 0.5);

    drawLegend(color, min, max);
}

// 绘制图例
function drawLegend(color, min, max) {
    const width = +svgLegend.attr("width");
    const height = +svgLegend.attr("height");

    const x = d3.scaleLinear()
        .domain([min, max])
        .rangeRound([350, 860]);

    const g = svgLegend.append("g")
        .attr("class", "key")
        .attr("transform", "translate(0,20)");

    g.selectAll("rect")
        .data(color.range().map(d => {
            const [a, b] = color.invertExtent(d);
            return [a ?? x.domain()[0], b ?? x.domain()[1]];
        }))
        .enter()
        .append("rect")
        .attr("height", 8)
        .attr("x", d => x(d[0]))
        .attr("width", d => x(d[1]) - x(d[0]))
        .attr("fill", d => color(d[0]));

    g.append("text")
        .attr("class", "caption")
        .attr("x", x.range()[0])
        .attr("y", -10)
        .attr("fill", "#000")
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .text("单位：" + unit + "");

    g.call(
        d3.axisBottom(x)
            .tickSize(13)
            .tickValues(color.range().map(d => color.invertExtent(d)[0]))
            .tickFormat(d => d3.format(",")(Math.floor(d / 1000) * 1000))
            //.tickFormat(d3.format(".0f"))
    ).select(".domain").remove();
}

function setProjection(width, height, cities) {
    switch(code) {
        case "CHN":
            projection.fitSize([width, height], cities);
            break;
        case "USA":
            projection = d3.geoAlbersUsa()
                .scale(1300)
                .translate([487.5, 305]);
            break;
    }
}