// 获取URL参数
const params = new URLSearchParams(window.location.search);
const countryCode = params.get("code");
const countryName = params.get("name");

// 设置文件路径
const jsonPath = `data/countries/${encodeURIComponent(countryName)}.json`;
const populationPath = `data/worldPopulation/${encodeURIComponent(countryName)}.csv`;
const gdpPath = `data/countries/${countryCode}-gdp.csv`;

// 初始化变量
let projection = d3.geoMercator();
let mapDataGlobal = null;
let svgMap = d3.select("#map");
let svgLegend = d3.select("#legend");
let unit = "";
let initialScale = 1;
let initialTranslate;
const ZOOM_SENSITIVITY = 0.5;
const DRAG_SENSITIVITY = 60; // 与文档2一致的拖拽灵敏度

// 设置页面标题
document.querySelector("h1").textContent = countryName;

// 加载地图数据
d3.json(jsonPath)
    .then(mapData => {
        if (!mapData || !mapData.features) {
            throw new Error("Invalid country data format");
        }
        mapDataGlobal = mapData;

        // 设置初始投影 - 确保整个国家可见
        setProjection(+svgMap.attr("width"), +svgMap.attr("height"), mapData);
        initialScale = projection.scale();

        // 添加交互行为
        addInteractions();
        updateMap(); // 初始加载
    })
    .catch(error => {
        console.error("Error loading country data:", error);
        alert("无法加载国家数据，请检查控制台");
    });

// 添加交互功能
function addInteractions() {
    // 存储初始平移和缩放状态
    let transform = d3.zoomIdentity;

    // 创建缩放行为
    const zoom = d3.zoom()
        .scaleExtent([ZOOM_SENSITIVITY, 8])
        .on('zoom', function (event) {

            transform = event.transform;

            // 应用变换到投影
            projection
                .scale(initialScale * transform.k)
                .translate([
                    initialTranslate[0] + transform.x,
                    initialTranslate[1] + transform.y
                ]);

            // 重绘地图
            redrawMap();
        });

    // 应用缩放行为到SVG
    svgMap.call(zoom);
}

// 重绘地图
function redrawMap() {

    //console.log("Checking mapDataGlobal:", mapDataGlobal);

    const path = d3.geoPath().projection(projection);
    svgMap.selectAll(".regions path").attr("d", path);
    svgMap.select(".borders").attr("d", path);
    svgMap.select(".outline").attr("d", path);
}

// 更新地图函数
function updateMap() {
    if (!mapDataGlobal) return;

    const type = "population";
    const year = "2023";

    const csvPath = type === "population" ? populationPath : gdpPath;
    const fallbackPath = type === "population" ? populationPath : `data/gdp.csv`;

    d3.csv(csvPath)
        .then(data => {

            processData(data);
        })
        .catch(error => {
            console.warn(`加载${csvPath}失败，使用默认数据: ${fallbackPath}`);

            return d3.csv(fallbackPath);
        })
        .then(data => {
            if (data) processData(data);
        });

    function processData(data) {
        const dataMap = new Map();
        data.forEach(d => {
            const region = d["region"];
            const value = +d[year];
            dataMap.set(region, value);

            if (!unit && d["unit"]) {
                unit = d["unit"];
            }
        });

        drawChoropleth(mapDataGlobal, dataMap);
    }
}

// 绘制地图函数
function drawChoropleth(mapData, dataMap) {
    console.log("SVG dimensions:",
        +svgMap.attr("width"),
        +svgMap.attr("height"),
        "Data bounds:", d3.geoBounds(mapData));
    svgMap.selectAll("*").remove();
    svgLegend.selectAll("*").remove();

    const width = +svgMap.attr("width");
    const height = +svgMap.attr("height");

    // 设置投影
    setProjection(width, height, mapData);
    const path = d3.geoPath().projection(projection);

    const values = Array.from(dataMap.values()).filter(v => !isNaN(v));
    const min = values.length ? d3.min(values) : 0;
    const max = values.length ? d3.max(values) : 1;

    const color = d3.scaleQuantize()
        .domain([min, max])
        .range(d3.schemeBlues[9]);

    // 绘制区域
    svgMap.append("g")
        .attr("class", "regions")
        .selectAll("path")
        .data(mapData.features)
        .enter()
        .append("path")
        .attr("fill", d => {
            const name = d.properties.name;
            const nameAlt = d.properties.name_alt || "";
            const alternatives = [name, ...nameAlt.split("|").map(n => n.trim())];
            const matchedName = alternatives.find(n => dataMap.has(n));
            const value = matchedName ? dataMap.get(matchedName) : null;
            return value != null ? color(value) : "#ccc";
        })
        .attr("d", path)
        .append("title")
        .text(d => {
            const name_en = d.properties.name_en;
            const name = d.properties.name;
            const nameAlt = d.properties.name_alt || "";

            const alternatives = [name_en, name, ...nameAlt.split("|").map(n => n.trim())];
            const matchedName = alternatives.find(n => dataMap.has(n));
            const value = matchedName ? dataMap.get(matchedName) : null;

            return `${name}${value != null ? `: ${value}${unit ? ` ${unit}` : ''}` : "（无数据）"}`;
        });

    // 绘制边界
    const mapDataCopy = structuredClone(mapData);
    const topo = topojson.topology({ provinces: mapDataCopy });

    svgMap.append("path")
        .datum(topojson.mesh(topo, topo.objects.provinces, (a, b) => a == b))
        .attr("class", "borders")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 0.5);

    svgMap.append("path")
        .datum(topojson.mesh(topo, topo.objects.provinces, (a, b) => a !== b))
        .attr("class", "outline")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 0.5);

    drawLegend(color, min, max);
}

// 设置投影 - 确保整个国家可见
function setProjection(width, height, geoData) {
    // 特殊国家投影设置
    switch (countryCode) {
        case "US":
        case "USA":
            projection = d3.geoAlbersUsa()
                .scale(1300)
                .translate([width / 2, height / 2]);
            break;
        case "RU":
            projection = d3.geoMercator()
                .center([100, 65])
                .scale(300)
                .translate([width / 2, height / 2]);
            break;
        default:
            const effectiveWidth = Math.max(100, +svgMap.attr("width") || 800);
            const effectiveHeight = Math.max(100, +svgMap.attr("height") || 600);

            projection = d3.geoMercator()
                .fitSize([effectiveWidth, effectiveHeight], geoData);
    }

    // 存储初始比例用于变换
    initialScale = projection.scale();
    initialTranslate = projection.translate();
}

// 绘制图例
function drawLegend(color, min, max) {
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
        .text(unit ? `单位：${unit}` : "");

    g.call(
        d3.axisBottom(x)
            .tickSize(13)
            .tickValues(color.range().slice(1).map(d => color.invertExtent(d)[0]))
            .tickFormat(d => d3.format(",")(Math.round(d)))
    ).select(".domain").remove();
}
