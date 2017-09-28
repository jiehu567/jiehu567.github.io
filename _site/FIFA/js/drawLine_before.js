function draw_line(data){
    var svg = dimple.newSvg("#chartContainer", 690, 650);

    var myChart = new dimple.chart(svg, data);
    myChart.setBounds(60, 80, 420, 380);
    
    var x = myChart.addTimeAxis("x", "year");
    x.tickFormat = '%Y';
    x.title = 'Year';

    var y = myChart.addMeasureAxis("y", "win_mean");
    y.title = "Rate, upper: Home / Lower: Away";
    
    y.tickFormat = ".0%";
    
    var s = myChart.addSeries(["type","name"], dimple.plot.line);
    s.lineMarkers = true;

    var myLegend = myChart.addLegend(600, 150, 60, 350, "right");

    myChart.draw();
    
    
    
    myChart.legends = [];
    
    // This block simply adds the legend title. I put it into a d3 data
        // object to split it onto 2 lines.  This technique works with any
        // number of lines, it isn't dimple specific.
    svg.selectAll("title_text")
          .data(["Click legend to","show/hide by Leagues:"])
          .enter()
          .append("text")
            .attr("x", 499)
            .attr("y", function (d, i) { return 140 + i * 14; })
            .style("font-family", "sans-serif")
            .style("font-size", "10px")
            .style("color", "Black")
            .text(function (d) { return d; });
    
     var filterValues = dimple.getUniqueValues(data, "name");
    
    myLegend.shapes.selectAll("rect")
          // Add a click event to each rectangle
          .on("click", function (e) {
            // This indicates whether the item is already visible or not
            var visible = true;
            var newFilters = [];
            // If the filters not contain the clicked shape hide it
            filterValues.forEach(function (f) {
                
              if (f === e.key) {
                
                  visible = false;
              } else {
                newFilters.push(f);
              }
            });
            // Hide the shape or show it
            if (!visible) {
              d3.select(this).style("opacity", 0.2);
            } else {
              newFilters.push(e.key);
              d3.select(this).style("opacity", 0.8);
            }
            // Update the filters
            filterValues = newFilters;
            // Filter the data
            myChart.data = dimple.filterData(data, "name", filterValues);
            // Passing a duration parameter makes the chart animate. Without
            // it there is no transition
            myChart.draw(800);
          });
      
    
}