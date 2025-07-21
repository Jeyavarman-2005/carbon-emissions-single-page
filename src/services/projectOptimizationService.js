export function optimizeProjects(projects, constraints) {
  const maxInvestment = Number(constraints.investment) || Infinity;
  const minCarbonKg = Number(constraints.carbonEmission) || 0;
  const maxProjectTimeline = constraints.targetDate ? 
    calculateTimeline(constraints.targetDate) : Infinity;

  // Filter feasible projects first
  const feasibleProjects = projects.filter(project => 
    (project['Lead time for implementation in Months'] || 0) <= maxProjectTimeline
  );

  // Determine optimization approach based on constraints
  if (minCarbonKg > 0) {
    // Case 1: Carbon constraint exists (keep existing working logic)
    if (maxInvestment > 5000 || !isFinite(maxInvestment)) {
      return greedyOptimizeWithCarbon(feasibleProjects, minCarbonKg, maxInvestment);
    }
    return dynamicProgrammingOptimize(feasibleProjects, minCarbonKg, maxInvestment);
  } else {
    // Case 2: Only investment constraint (new optimized logic)
    return optimizeForInvestmentOnly(feasibleProjects, maxInvestment);
  }
}

// Existing working implementation for carbon-constrained cases
function greedyOptimizeWithCarbon(projects, minCarbonKg, maxInvestment) {
  // Sort by carbon reduction per rupee (most efficient first)
  const sorted = [...projects].sort((a, b) => {
    const aEff = (a['Estimated Carbon Reduction in Kg/CO2 per annum'] || 0) / 
                 (a['Estimated Investment in Rs.'] || 1);
    const bEff = (b['Estimated Carbon Reduction in Kg/CO2 per annum'] || 0) / 
                 (b['Estimated Investment in Rs.'] || 1);
    return bEff - aEff;
  });

  let totalInvestment = 0;
  let totalCarbon = 0;
  const selectedProjects = [];
  let maxTime = 0;

  for (const project of sorted) {
    const projectCost = project['Estimated Investment in Rs.'] || 0;
    if (totalInvestment + projectCost > maxInvestment) continue;
    
    selectedProjects.push(project);
    totalInvestment += projectCost;
    totalCarbon += project['Estimated Carbon Reduction in Kg/CO2 per annum'] || 0;
    maxTime = Math.max(maxTime, project['Lead time for implementation in Months'] || 0);
    
    if (totalCarbon >= minCarbonKg) break;
  }

  return {
    status: totalCarbon >= minCarbonKg ? 'optimal' : 'infeasible',
    selectedProjects,
    totalInvestment,
    totalCarbonReduction: totalCarbon,
    maxProjectTimeline: maxTime
  };
}

// New implementation for investment-only case
function optimizeForInvestmentOnly(projects, maxInvestment) {
  // Sort by carbon reduction (descending) to maximize impact
  const sorted = [...projects].sort((a, b) => 
    (b['Estimated Carbon Reduction in Kg/CO2 per annum'] || 0) - 
    (a['Estimated Carbon Reduction in Kg/CO2 per annum'] || 0)
  );

  let totalInvestment = 0;
  const selectedProjects = [];
  let totalCarbon = 0;
  let maxTime = 0;

  for (const project of sorted) {
    const projectCost = project['Estimated Investment in Rs.'] || 0;
    if (totalInvestment + projectCost > maxInvestment) continue;
    
    selectedProjects.push(project);
    totalInvestment += projectCost;
    totalCarbon += project['Estimated Carbon Reduction in Kg/CO2 per annum'] || 0;
    maxTime = Math.max(maxTime, project['Lead time for implementation in Months'] || 0);
  }

  return {
    status: 'optimal',
    selectedProjects,
    totalInvestment,
    totalCarbonReduction: totalCarbon,
    maxProjectTimeline: maxTime
  };
}

// Keep existing DP implementation unchanged
function dynamicProgrammingOptimize(projects, minCarbonKg, maxInvestment) {
  const dpSize = Math.min(maxInvestment, 5000);
  const dp = Array(dpSize + 1).fill({ carbon: 0, selected: [] });

  for (const project of projects) {
    const cost = project['Estimated Investment in Rs.'] || 0;
    const carbon = project['Estimated Carbon Reduction in Kg/CO2 per annum'] || 0;
    
    for (let j = dpSize; j >= cost; j--) {
      if (dp[j - cost].carbon + carbon > dp[j].carbon) {
        dp[j] = {
          carbon: dp[j - cost].carbon + carbon,
          selected: [...dp[j - cost].selected, project]
        };
      }
    }
  }

  const best = dp.reduce((best, curr) => 
    curr.carbon >= minCarbonKg && curr.carbon > best.carbon ? curr : best, 
    { carbon: 0 }
  );

  return {
    status: best.carbon >= minCarbonKg ? 'optimal' : 'infeasible',
    selectedProjects: best.selected || [],
    totalInvestment: best.selected?.reduce((sum, p) => sum + (p['Estimated Investment in Rs.'] || 0), 0) || 0,
    totalCarbonReduction: best.carbon,
    maxProjectTimeline: best.selected?.reduce((max, p) => Math.max(max, p['Lead time for implementation in Months'] || 0), 0) || 0
  };
}

function calculateTimeline(targetDate) {
  try {
    const today = new Date();
    const target = new Date(targetDate);
    if (isNaN(target.getTime())) return Infinity;
    
    const months = (target.getFullYear() - today.getFullYear()) * 12 + 
                   (target.getMonth() - today.getMonth());
    return Math.max(0, months);
  } catch (error) {
    console.error('Error calculating timeline:', error);
    return Infinity;
  }
}