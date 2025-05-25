// 获取URL参数
const params = new URLSearchParams(window.location.search);
const countryCode = params.get("code");
const countryName = params.get("name");
let dataType = params.get("type");
let dataYear = params.get("year");

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
const DRAG_SENSITIVITY = 60;

const COLOR_SCALE = [
    "#FFFFCC", // 第1档（最浅黄）
    "#FED976", // 第2档（浅橙黄）
    "#FEB24C", // 第3档（橙黄）
    "#FD8D3C", // 第4档（橙红）
    "#c21f1f", // 第5档（正红）
    "#5C1010"  // 第6档（深红）
];
const COLOR_NO_DATA = "#B2B2B2";
const COLOR_HOVER = "#D3D3D3";

// 添加工具提示
const tooltip = d3.select("body").append("div")
    .attr("id", "hover-tooltip")
    .style("opacity", 0);

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

function setProjection(width, height, geoData) {
    const effectiveWidth = Math.max(100, +svgMap.attr("width") || 800);
    const effectiveHeight = Math.max(100, +svgMap.attr("height") || 600);
    projection = d3.geoMercator()
        .fitSize([effectiveWidth, effectiveHeight], geoData);
    // 存储初始比例用于变换
    initialScale = projection.scale();
    initialTranslate = projection.translate();
}

// 添加交互功能（改进版）
function addInteractions() {
    const zoom = d3.zoom()
        .scaleExtent([ZOOM_SENSITIVITY, 8])
        .on("zoom", function (event) {
            const transform = event.transform;

            // 获取当前缩放层级和偏移
            const scale = initialScale * transform.k;
            const translate = [
                initialTranslate[0] * transform.k + transform.x,
                initialTranslate[1] * transform.k + transform.y
            ];

            projection
                .scale(scale)
                .translate(translate);

            redrawMap();
        });

    svgMap.call(zoom);
}

// 重绘地图
function redrawMap() {
    const path = d3.geoPath().projection(projection);
    svgMap.selectAll(".regions path").attr("d", path);
    svgMap.select(".borders").attr("d", path);
    svgMap.select(".outline").attr("d", path);
}

// 更新地图函数
function updateMap() {

    if (!mapDataGlobal) return;

    // 设置国家标题
    d3.select("#country-title").text(countryName);
    const type = dataType || "population";
    const year = dataYear;
    console.log("Initial dataType from URL:", dataType);
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
        const validValues = [];

        data.forEach(d => {
            const region = d["region"];
            const value = +d[year];

            // 只存储有效值
            if (!isNaN(value) && value > 0) {
                dataMap.set(region, value);
                validValues.push(value);
            } else {
                dataMap.set(region, null);
            }
        });

        unit = data[0]["unit"];
        console.log("Valid data values:", validValues);
        console.log(unit);
        drawChoropleth(mapDataGlobal, dataMap, validValues);
    }
}

// 绘制地图函数
function drawChoropleth(mapData, dataMap, validValues) {
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

    const min = validValues.length ? d3.min(validValues) : 0;
    const max = validValues.length ? d3.max(validValues) : 1;

    // 创建动态分档阈值（6档）
    const thresholds = [];
    if (max > min) {
        // 使用对数分档（类似index.js的实现）
        const logMin = Math.log10(Math.max(min, 1)); // 确保最小值>=1
        const logMax = Math.log10(max);
        const logStep = (logMax - logMin) / 6;

        for (let i = 1; i <= 6; i++) {
            thresholds.push(Math.pow(10, logMin + i * logStep));
        }
    } else {
        // 如果数据范围太小，使用线性分档
        const step = (max - min) / 6;
        for (let i = 1; i <= 6; i++) {
            thresholds.push(min + i * step);
        }
    }

    // 创建颜色比例尺（与index.js一致）
    const colorScale = d3.scaleThreshold()
        .domain(thresholds.slice(0, 5)) // 前5个阈值划分6档
        .range(COLOR_SCALE);

    // 绘制区域
    svgMap.append("g")
        .attr("class", "regions")
        .selectAll("path")
        .data(mapData.features)
        .enter()
        .append("path")
        .attr("class", "countries")
        .attr("fill", d => {
            const name = d.properties.name;
            const name_en = d.properties.name_en;
            const nameAlt = d.properties.name_alt || "";
            const alternatives = [name, name_en, ...nameAlt.split("|").map(n => n.trim())];
            const matchedName = alternatives.find(n => dataMap.has(n));
            const value = matchedName ? dataMap.get(matchedName) : null;

            if (value === null || isNaN(value) || value <= 0) return COLOR_NO_DATA;

            // 确保值在范围内
            const clampedValue = Math.max(min, Math.min(value, max));
            return colorScale(clampedValue);
        })
        .attr("d", path)
        .on("mouseover", function (event, d) {
            const name = d.properties.name;
            const name_en = d.properties.name_en;
            const name_zh = d.properties.name_zh;
            const nameAlt = d.properties.name_alt || "";
            const alternatives = [name, name_en, ...nameAlt.split("|").map(n => n.trim())];
            const matchedName = alternatives.find(n => dataMap.has(n));
            const value = matchedName ? dataMap.get(matchedName) : null;

            const element = d3.select(this);
            const currentColor = element.style("fill");
            element.attr("data-original-color", currentColor);
            element.style("fill", COLOR_HOVER);

            d3.select(this)
                .classed("highlighted", true)
                .raise();

            // 处理经纬度显示
            const longitude = +d.properties.longitude;
            const latitude = +d.properties.latitude;
            const lonStr = `${Math.abs(longitude).toFixed(1)}°${longitude >= 0 ? 'E' : 'W'}`;
            const latStr = `${Math.abs(latitude).toFixed(1)}°${latitude >= 0 ? 'N' : 'S'}`;

            if (value !== null && !isNaN(value)){
                tooltip.transition()
                    .duration(200)
                    .style("opacity", 0.9);

                tooltip.html(`
            <div class="tooltip-title">${name_zh}</div>
            <div class="tooltip-row"><span class="tooltip-label">${name_en}</span></div>
            ${nameAlt ? `<div class="tooltip-row"><span class="tooltip-label">${nameAlt.replace(/\|/g, ", ")}</span></div>` : ''}
            <div class="tooltip-row"><span class="tooltip-coord">${lonStr} / ${latStr}</span></div>
            <div class="tooltip-row"><span class="tooltip-value">${formatValue(value)}${unit ? ` ${unit}` : ''}</span></div>
        `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            }
        })
        .on("mouseout", function () {
            d3.select(this)
                .classed("highlighted", false);

            const element = d3.select(this);
            element.style("fill", element.attr("data-original-color")); // 恢复原色

            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        })
        .on("click", function (event, d) {
            // Remove highlight from all paths
            svgMap.selectAll(".countries")
                .classed("highlighted", false);

            // Highlight clicked path
            d3.select(this)
                .classed("highlighted", true)
                .raise();

            // Keep tooltip visible on click
            const name = d.properties.name;
            const nameAlt = d.properties.name_alt || "";
            const alternatives = [name, ...nameAlt.split("|").map(n => n.trim())];
            const matchedName = alternatives.find(n => dataMap.has(n));
            const value = matchedName ? dataMap.get(matchedName) : null;

            if (value !== null && !isNaN(value) && value > 0) {
                tooltip.style("opacity", 0.9)
                    .html(`
                        <div><strong>${name}</strong></div>
                        <div>${formatValue(value)}${unit ? ` ${unit}` : ''}</div>
                    `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            }
        });

    // 绘制边界（保持不变）
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

    // 修改drawLegend函数调用
    drawLegend(colorScale, min, max);
}

// 动态计算单位
function formatValue(value) {
    if (value >= 1e8) {
        return `${(value / 1e8).toFixed(1)}亿`; // 亿单位
    } else if (value >= 1e4) {
        return `${(value / 1e4).toFixed(1)}万`; // 万单位
    }
    return value.toLocaleString(); // 小于1万直接显示
}

function drawLegend(colorScale, min, max) {
    const legendContainer = d3.select("#header-legend")
        .style("width", "880px")
        .style("height", "50px")  // 增加固定高度
        .style("display", "block") // 确保是块级元素
        .style("overflow", "visible"); // 确保内容可见

    legendContainer.selectAll("*").remove();

    legendContainer.append("div")
        .style("height", "20px")
        .style("background", `linear-gradient(to right, ${COLOR_SCALE.join(",")})`)
        .style("margin-bottom", "5px");

    // 2. 创建刻度轴（动态单位）
    const legendSvg = legendContainer.append("svg")
        .style("width", "880px")
        .style("height", "15px") // 仅刻度线高度
        .style("margin-top", "-5px") // 向上偏移，与色块重叠
        .style("display", "block");

    const legendWidth = 880;

    // 创建线性比例尺（更适应动态单位）
    const xScale = d3.scaleLinear()
        .domain([min, max])
        .range([0, legendWidth]);

    // 生成5个均匀分布的刻度值
    const tickValues = [];
    const step = (max - min) / 5;
    for (let i = 0; i <= 5; i++) {
        tickValues.push(min + i * step);
    }

    // 添加刻度轴
    legendSvg.append("g")
        .attr("transform", "translate(0, 0)")
        .call(d3.axisBottom(xScale)
            .tickValues(tickValues)
            .tickFormat(formatValue)
            .tickSize(8)
        )
        .selectAll(".tick text")
        .style("font-size", "10px");

    console.log("Color scale:", COLOR_SCALE);
    console.log("Gradient string:", `linear-gradient(to right, ${COLOR_SCALE.join(",")})`);
    console.log("Legend container dimensions:",
        legendContainer.node().getBoundingClientRect());
}
// 处理点击地图外部区域清除选择
d3.select("body").on("click", function (event) {
    if (!event.target.closest("#map")) {
        svgMap.selectAll(".countries")
            .classed("highlighted", false);
        tooltip.style("opacity", 0);
    }
});

// 监听按钮事件，接收类型
window.addEventListener('message', (event) => {
    if (event.data && event.data.type) {
        const type = event.data.type;
        console.log('接收到类型:', type);
        dataType = type;
        updateMap();
    }
});

// 监听滑动条事件，接收年份
window.addEventListener('message', (event) => {
    if (event.data && event.data.year) {
        const year = event.data.year;
        console.log('接收到年份:', year);
        dataYear = year;
        updateMap();
    }
});
