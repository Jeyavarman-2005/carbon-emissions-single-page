import { optimizeProjects } from './projectOptimizationService';

export const filterProjects = async (projects, params) => {
  console.groupCollapsed('[filterProjects] Entry');
  try {
    console.log('Input Params:', params);

    const result = await optimizeProjects(projects, {
      investment: Number(params.investment) || Infinity,
      carbonEmission: Number(params.carbonEmission) || 0,
      targetDate: params.targetDate
    });

    console.log('Optimization Result:', result);

    // Handle different status cases
    if (result.status === 'infeasible') {
      console.warn('Infeasible Solution - Solver Status:', result.solverStatus);
      return {
        filteredProjects: [],
        topProjects: createPlaceholderProjects(),
        message: result.solverStatus === 3 ? 
          'Constraints too strict - no feasible solution' :
          'Optimization did not converge to optimal solution'
      };
    }

    if (result.status === 'error' || !result.selectedProjects) {
      console.error('Optimization Error:', result.message);
      return {
        filteredProjects: [],
        topProjects: createPlaceholderProjects(),
        message: 'Technical error during optimization'
      };
    }

    // Prepare results
    const sortedProjects = [...result.selectedProjects].sort((a, b) => 
      b['Estimated Carbon Reduction in Kg/CO2 per annum'] - 
      a['Estimated Carbon Reduction in Kg/CO2 per annum']
    );

    const topProjects = sortedProjects.slice(0, 5).map((p, i) => formatProject(p, i + 1));
    while (topProjects.length < 5) {
      topProjects.push(createPlaceholderProject(topProjects.length + 1));
    }

    return {
      filteredProjects: result.selectedProjects,
      topProjects,
      summary: {
        totalInvestment: result.totalInvestment,
        totalCarbonReduction: result.totalCarbonReduction,
        maxTimeline: result.maxProjectTimeline
      }
    };

  } catch (error) {
    console.error('Filter Error:', error);
    return {
      filteredProjects: [],
      topProjects: createPlaceholderProjects(),
      message: 'Error processing optimization'
    };
  } finally {
    console.groupEnd();
  }
};

// Helper functions with logging
function formatProject(project, index) {
  const formatted = {
    id: index,
    name: project['Project Information in details'] || project.Project || '--',
    reduction: Math.round(project['Estimated Carbon Reduction in Kg/CO2 per annum'] || 0),
    investment: project['Estimated Investment in Rs.']?.toLocaleString() || '--',
    TimeTaken: project['Estimated Timeline in months'] || project['Estimated Timeline'] || '--',
    category: project.Category || '--',
    approach: project.Approach || '--'
  };
  console.log(`Formatting project ${index}:`, project, '->', formatted);
  return formatted;
}
function createPlaceholderProject(id) {
  return {
    id,
    name: '--',
    reduction: '--',
    investment: '--',
    timeline: '--',
    category: '--',
    approach: '--'
  };
}

function createPlaceholderProjects() {
  return Array(5).fill().map((_, i) => createPlaceholderProject(i + 1));
}
