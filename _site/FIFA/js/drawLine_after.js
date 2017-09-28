function draw_line(data){
    //plot the chart
    var svg = dimple.newSvg("#chartContainer", 690, 350);

    var myChart = new dimple.chart(svg, data);
    myChart.setBounds(80, 20, 440, 280);
    
    var x = myChart.addTimeAxis("x", "year");
    x.tickFormat = '%Y';
    x.title = 'Year';
    x.fontSize = 15;
    
    var y = myChart.addMeasureAxis("y", "win_mean");
    y.title = "Average Wins";
    
    y.tickFormat = ".0%";
    y.fontSize = 15;
    
    var s = myChart.addSeries(["type","name"], dimple.plot.line);
    
    s.lineMarkers = true;
    
    // Use a custom tooltip
    s.getTooltipText = function (e) {
        
        return ["Year: "+ e.cx.getUTCFullYear(), 
                "League: "+ e.aggField[1],
                "Type: "+ e.aggField[0],
                "Average Wins: "+Math.round(e.cy*100)/100];
    };

    
    var myLegend = myChart.addLegend(620, 150, 80, 350, "right");

    myChart.draw();
    
    var dashline = svg.selectAll("path.dimple-away").style("stroke-dasharray", "2");
    
    myChart.legends = [];
    
    svg.selectAll("title_text")
              .data(["Click legend to","show/hide by Leagues:"])
              .enter()
              .append("text")
                .attr("x", 550)
                .attr("y", function (d, i) { return 140 + i * 14; })
                .style("font-family", "sans-serif")
                .style("font-size", "10px")
                .style("color", "Black")
                .text(function (d) { return d; });
    
    
    // initialize chart with lines of first league and hide the others
     var filterValues = dimple.getUniqueValues(data, "name");
    
    
    firstValue = "Spain LIGA BBVA";
    
    
    myChart.data = dimple.filterData(data, "name", firstValue);
            // Passing a duration parameter makes the chart animate. Without
            // it there is no transition
    myChart.draw(800);
    
    var rect_select = myLegend.shapes
                                 .selectAll("rect")
                                 .style("opacity", 0.2)
                                 .style('stroke-width', '2px')
                                 .attr('z-index', '0');
    
    d3.select('rect').style('opacity', 0.8);
    
    var selectFilter = [firstValue];
          // Add a click event to each rectangle
   
    
    // if click other league legend, display or fade the line
    rect_select.on("click", function (e) {
            
         if (selectFilter.includes(e.key)) {
            
            index = selectFilter.indexOf(e.key);
            selectFilter.splice(index, 1);
            d3.select(this)
                .style('opacity', 0.2);
                
            
            
        } else {
            selectFilter.push(e.key);
            d3.select(this)
                .style('opacity', 0.8);
            
        }
            
            myChart.data = dimple.filterData(data, "name", selectFilter);
            
            myChart.draw(800);
            svg.selectAll("path.dimple-away").style("stroke-dasharray", "2");
        
            svg.selectAll('path')
                .on('mouseover', function(e) {
                  
                    
                  
                    var league_name = e.key[1];
                    
                    var str_arr = e.key[1].toLowerCase().split(" ");
                    var dimple_name = ".dimple";
                    for(var i=0;i<str_arr.length;i++){
                        dimple_name += "-";
                        dimple_name += str_arr[i];
                    }
                
                    
                    var bold_line = d3.selectAll(dimple_name)
                                    .style('stroke-width', '8px')
                                    .attr('z-index', '1');
                
                              }).on('mouseleave', function(e) {
                                  
                                var league_name = e.key[1];

                                var str_arr = e.key[1].toLowerCase().split(" ");
                                var dimple_name = ".dimple";
                                for(var i=0;i<str_arr.length;i++){
                                    dimple_name += "-";
                                    dimple_name += str_arr[i];
                                }
                                    
                                    d3.selectAll(dimple_name)
                                    .style('stroke-width', '2px')
                                    .attr('z-index', '0');

                              });
        
        
        
    });
      
    
}