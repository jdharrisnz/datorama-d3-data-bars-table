var dataBarsTable = {
  'initialize': function() {
    // Don't do anything if the query is invalid
      var query = DA.query.getQuery();
      if (Object.keys(query.fields).length === 0) {
        d3.select('#__da-app-content')
        .html('<h1>Just add data!</h1><p>Add data in your widget settings to start making magic happen.</p>')
        javascriptAbort(); // Garbage meaningless function to get the widget to stop processing
      }

    // Store the query result
      var queryResult = DA.query.getQueryResult();
      var dimCount = queryResult.fields.filter(x => x.type == 'dimension').length;
      var metricCount = queryResult.fields.filter(x => x.type == 'metric').length;
    
    // Create hierarchichal groups
      var tbodyGrouped = d3.nest();
      
      queryResult.fields.forEach((field, index) => {
        if (field.type == 'dimension') {
          tbodyGrouped = tbodyGrouped.key(d => d.map(x => x.formattedValue)[index]);
        }
      });
      tbodyGrouped = tbodyGrouped.rollup(d => {
        var rollupResult = [];
        queryResult.fields.forEach((field, index) => {
          if (field.type == 'metric') {
            rollupResult.push({'metric': field.name, 'metricIndex': index, 'value': d.map(x => x[index].value)[0], 'formattedValue': d.map(x => x[index].formattedValue)[0] });
          }
        });
        return rollupResult;
      });
      tbodyGrouped = tbodyGrouped.entries(queryResult.rows);
    
    // Create the document structure
      var table = d3.select('#__da-app-content').append('div').attr('id', 'table');
      var thead = table.append('div').style('display', 'contents');
      var tbody = table.append('div').style('display', 'contents');
      var ttotal = table.append('div').style('display', 'contents');
    
    // Specify the table layout
      table.style('display', 'grid').style('grid-template-columns', 'repeat(' + queryResult.fields.length + ', auto)');
    
    // Populate the table header
      thead.selectAll('div')
      .data(queryResult.fields)
      .join('div')
        .style('grid-column', 'auto / auto')
        .attr('class', d => 'header ' + d.type)
        .append('span')
          .text(d => d.name);
    
    // Create and execute a recursive function to populate the table body
      var interpolateShade = d3.interpolateRgb('rgba(255, 255, 255, 0.9)', 'rgba(200, 200, 200, 0.9)');
      
      function tbodyGenerator(container, children, generation, generations) {
        container.selectAll('div')
        .data(() => {
          var cells = [];
          if (generation < generations - 1) { cellClass = 'bodyparent bodylevel' + generation; }
          else { cellClass = 'bodychild'; }
          var rowShade = interpolateShade((generations - generation) / 10);
          
          children.forEach((child, i) => {
            if (generation > 0) { cells.push({'name': null, 'class': cellClass, 'rowShade': null, 'grid-column': 'auto / span ' + generation}); }
            if (generation < generations - 1) { cells.push({'name': child.key, 'class': cellClass, 'rowShade': rowShade, 'grid-column': 'auto / span ' + (generations - generation + metricCount), 'children': child.values}); }
            else {
              if (i % 2 === 0) { rowShadeStore = rowShade; rowShade = null; } else { rowShade = rowShadeStore; }
              cells.push({'name': child.key, 'class': cellClass, 'rowShade': rowShade, 'grid-column': 'auto / auto'});
              child.value.forEach(metric => {
                cells.push({'name': metric.formattedValue, 'value': metric.value, 'metricIndex': metric.metricIndex, 'class': cellClass + ' metric body', 'rowShade': rowShade, 'grid-column': 'auto / auto'});
              });
            }
          });
          return cells;
        })
        .join('div')
          .style('grid-column', d => d['grid-column'])
          .style('background-color', d => d.rowShade)
          .attr('class', d => d.class)
          .attr('title', d => d.name)
          .append('span')
            .attr('class', d => { if (d.class.includes('metric')) { return 'dataText'; } })
            .text(d => { return d.name; });
        
        if (generation + 1 <= generations - 1) {
          container.selectAll('div[title]').each(function(d) {
            tbodyGenerator(d3.select(this.parentNode).insert('div', 'div[title="' + d.name + '"] + div').style('display', 'contents'), d.children, generation + 1, generations);
          });
        }
      }
      
      tbodyGenerator(tbody, tbodyGrouped, 0, dimCount);
    
    // Populate the table total
      ttotal.selectAll('div')
      .data(['Total'].concat(queryResult.totals[0].data[0]))
      .join('div')
        .style('grid-column', d => { if (d == 'Total') { return 'auto / span ' + dimCount; } else { return 'auto / auto'; } })
        .attr('class', d => { if (d == 'Total') { return 'dimension total'; } else { return 'metric total'; } })
        .append('span')
          .text(d => d);
    
    // Create the data bars
      var svgSpan = d3.selectAll('div.metric.body')
      .append('span')
        .attr('class', 'dataSVG');
      
      var svg = svgSpan.append('svg')
        .attr('width', '100%')
        .attr('height', '100%');
      
      var dataBars = svg.append('rect')
        .attr('class', d => 'metric' + (d.metricIndex - dimCount))
        .attr('transform', 'scale(0, 0.8)')
        .attr('transform-origin', 'center left')
        .attr('width', d => d.value / d3.max(queryResult.rows.map(x => x[d.metricIndex].value)) * 100 + '%')
        .attr('height', '100%');
      
      dataBars.transition().duration(600).attr('transform', 'scale(0.9, 0.8)');
    
    // Create the collapsible controls
      var collapseSpan = d3.selectAll('.bodyparent[title]')
      .insert('span', 'span')
        .attr('class', 'collapsible')
        .on('click', function(d) {
          if (this.parentNode.nextSibling.style.display == 'contents') {
            d3.select(this).select('svg').attr('transform', 'rotate(-90)');
            d3.select(this.parentNode.nextSibling).style('display', 'none');
          }
          else {
            d3.select(this).select('svg').attr('transform', 'rotate(0)');
            d3.select(this.parentNode.nextSibling).style('display', 'contents');
          }
        })
        .on('mouseenter', function() {
          d3.select(this).select('svg').select('path').style('fill', 'rgb(10, 135, 198)');
        })
        .on('mouseleave', function() {
          d3.select(this).select('svg').select('path').style('fill', 'rgb(156, 160, 160)');
        });
      
      var collapseSVG = collapseSpan.append('svg')
        .attr('width', '12px')
        .attr('viewBox', '0 0 10 6')
        .attr('transform', 'rotate(0)')
        .attr('transform-origin', 'center');
      
      var collapsePath = collapseSVG.append('path')
        .style('fill', 'rgb(156, 160, 160)')
        .attr('d', 'M5.09 5.5a.5.5 0 0 1-.35-.15l-4-4a.5.5 0 0 1 .71-.7l3.64 3.64L8.74.65a.5.5 0 0 1 .71.71l-4 4a.5.5 0 0 1-.36.14z');
      }
};
