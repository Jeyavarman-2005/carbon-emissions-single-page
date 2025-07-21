import React, { useState, useEffect, useReducer, useMemo, useCallback } from 'react';
import { getBusinesses, getPlantData, downloadExcelFile } from '../services/api';
import { filterProjects } from '../services/projectFilterService';
import { FiBriefcase, FiPackage, FiSettings, FiArrowRight, FiLoader, FiDownload , FiUpload } from 'react-icons/fi';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, LabelList, Label } from 'recharts';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { throttle } from 'lodash';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import styles from './CarbonFootprintPage.module.css';
import supabase from '../services/supabase';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';


const paramsReducer = (state, action) => {
  switch (action.type) {
    case 'UPDATE_DATE':
      return { ...state, targetDate: action.payload };
    case 'UPDATE_INVESTMENT':
      return { ...state, investment: action.payload };
    case 'UPDATE_EMISSION':
      return { ...state, carbonEmission: action.payload };
    case 'COMMIT_PARAMS':
      return { ...state, committed: true, ...action.payload };
    default:
      return state;
  }
};

// Memoized Chart Components
const EmissionsChart = React.memo(({ data, loading }) => {
  if (loading) return (
    <div className={styles.chartPlaceholder}>
      <div className={styles.placeholderContent}>
        <FiLoader className={styles.spinner} style={{ fontSize: '2rem' }} />
        <p>Loading emissions data...</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className={styles.chartPlaceholder}>
      <div className={styles.placeholderContent}>
        <h3>No Chart Data</h3>
        <p>Select a business and plant to view emissions visualization</p>
      </div>
    </div>
  );

  return (
    <ResponsiveContainer width="100%" height="90%">
      <ComposedChart
        data={data}
        margin={{ top: 20, right: 30, left:52.5, bottom: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis 
          dataKey="year" 
          tick={{ fill: '#6B7280' }}
          axisLine={{ stroke: '#E5E7EB' }}
          padding={{ left: 20, right: 20 }}
        />
        <YAxis 
          label={{ 
            value: 'Carbon Emission in kg', 
            angle: -90, 
            position: 'insideLeft',
            fill: '#6B7280',
            fontWeight:"bold",
            dx : -47.5,
            dy: 90
        
          }}
          tick={{ fill: '#6B7280' }}
          axisLine={{ stroke: '#E5E7EB' }}
        />
        <Bar 
          dataKey="scope1" 
          name="Scope 1" 
          stackId="a" 
          fill="#3B82F6"
          radius={[4, 4, 0, 0]}
          barSize={50}
        >
          <LabelList 
            dataKey="scope1" 
            position="inside" 
            formatter={(value) => value > 0 ? `S1` : ''}
            fill="#fff"
          />
        </Bar>
        <Bar 
          dataKey="scope2" 
          name="Scope 2" 
          stackId="a" 
          fill="#10B981"
          radius={[4, 4, 0, 0]}
          barSize={50}
        >
          <LabelList 
            dataKey="scope2" 
            position="inside" 
            formatter={(value) => value > 0 ? `S2` : ''}
            fill="#fff"
          />
        </Bar>
        <Bar 
          dataKey="total" 
          name="Total" 
          fill="transparent"
        >
          <LabelList
            dataKey="total"
            position="top"
            fill="#374151"
            content={(props) => {
              const { x, y, value } = props;
              return (
                <text
                  x={x - 30}
                  y={y-5}
                  fill="#374151"
                  textAnchor="middle"
                  fontSize={16}  
                  fontWeight="bold" 
                >
                  {`Total: ${value}`}
                </text>
              );
            }}
          />
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}, (prevProps, nextProps) => {
  return JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data) && 
         prevProps.loading === nextProps.loading;
});

const CarbonFootprintPage = () => {
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const navigate = useNavigate();

  // New state from Dashboard section
  const [businesses, setBusinesses] = useState([]);
  const [plants, setPlants] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('');
  const [selectedBusinessName, setSelectedBusinessName] = useState('');
  const [selectedPlantName, setSelectedPlantName] = useState('');
  const [emissionsData, setEmissionsData] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [committedParams, setCommittedParams] = useState(null);
  const [initialEmissionsData, setInitialEmissionsData] = useState(null);
  const [renewableData, setRenewableData] = useState(null);
  const [loading, setLoading] = useState({
    businesses: false,
    plants: false,
    emissions: false,
    projects: false,
    download: false,
    submit: false 
  });
  const [error, setError] = useState('');
  const [projectParams, setProjectParams] = useState({
    targetDate: new Date(),
    investment: '',
    carbonEmission: ''
  });
  const [topProjects, setTopProjects] = useState([
    { id: 1, name: '--', reduction: '--', investment: '--', TimeTaken: '--' },
    { id: 2, name: '--', reduction: '--', investment: '--', TimeTaken: '--' },
    { id: 3, name: '--', reduction: '--', investment: '--', TimeTaken: '--' },
    { id: 4, name: '--', reduction: '--', investment: '--', TimeTaken: '--' },
    { id: 5, name: '--', reduction: '--', investment: '--', TimeTaken: '--' }
  ]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);

  // Use reducer for parameters
  const [params, dispatch] = useReducer(paramsReducer, {
    targetDate: new Date(),
    investment: '',
    carbonEmission: '',
    committed: false
  });
  const [summaryInfo, setSummaryInfo] = useState({
  type: null, // 'carbon' or 'investment'
  value: null
});

  const businessName = watch("businessName");
  const plantName = watch("plantName");


  // Handle file change
  const handleFileChange = (e) => {
    if (!businessName?.trim() || !plantName?.trim()) {
      alert('Please enter Business Name and Plant Name first');
      return;
    }

    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        alert('File size exceeds 10MB limit');
        return;
      }
      setFile(selectedFile);
      setUploadStatus(null);
      setUploadProgress(0);
    }
  };

  // Process Excel file
  const processExcelFile = async (file) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      
      // Process Sheet1 (emissions data)
      const sheet1 = workbook.Sheets[workbook.SheetNames[0]];
      const sheet1Data = XLSX.utils.sheet_to_json(sheet1, { header: 1 });
      
      // Extract data from Sheet1
      const emissionsData = {};
      const years = sheet1Data[0].slice(1); // Get years from header row
      
      sheet1Data.slice(1).forEach(row => {
        const parameter = row[0];
        // Create consistent keys by removing spaces and special characters
        const paramKey = parameter.toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .replace('ins', ''); // Remove 'in' from keys like 'scope1inkgs'
        
        years.forEach((year, index) => {
          emissionsData[`${paramKey}_${year}`] = row[index + 1] || 0;
        });
      });
      
      return emissionsData;
    } catch (error) {
      console.error('Error processing Excel file:', error);
      throw error;
    }
  };

  // Handle form submission
  const onSubmit = async (data) => {
    setIsProcessing(true);

    try {
      // Process Excel file if uploaded
      let emissionsData = {};
      if (file) {
        emissionsData = await processExcelFile(file);
      }

      // Upsert business
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .upsert({ name: data.businessName }, { onConflict: 'name' })
        .select()
        .single();

      if (businessError) throw businessError;

      // Upsert plant
      const { data: plant, error: plantError } = await supabase
        .from('plants')
        .upsert({ 
          business_id: business.id, 
          name: data.plantName 
        }, { onConflict: 'business_id,name' })
        .select()
        .single();

      if (plantError) throw plantError;

      // Save emissions data to Supabase
      const { error: emissionsError } = await supabase
        .from('emissions_data')
        .upsert({
          plant_id: plant.id,
          ...emissionsData
        }, { onConflict: 'plant_id' });

      if (emissionsError) throw emissionsError;

      // Upload file if one was selected
      if (file) {
        await handleFileUpload(plant.id);
      }

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        navigate('/success');
      }, 1500);
    } catch (error) {
      console.error('Submission error:', error);
      alert('Error saving data: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (plantId) => {
    if (!file) {
      alert('Please select a file first');
      return;
    }

    try {
      setUploadStatus('uploading');
      
      // Generate a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `project-files/${fileName}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase
        .storage
        .from('carbon-footprint')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (progress) => {
            setUploadProgress((progress.loaded / progress.total) * 100);
          }
        });

      if (uploadError) throw uploadError;

      // Save file metadata to database
      const { error: dbError } = await supabase
        .from('project_files')
        .insert({
          plant_id: plantId,
          original_filename: file.name,
          storage_path: filePath
        });

      if (dbError) throw dbError;

      setUploadStatus('success');
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
    }
  };

const downloadTemplate = async () => {
  try {
    // Path to your pre-made template in the public folder
    const templatePath = '/Carbon_Footprint_Template.xlsx';
    
    // Fetch the template file
    const response = await fetch(templatePath);
    
    if (!response.ok) {
      throw new Error('Failed to fetch template');
    }
    
    // Get the file as a blob
    const blob = await response.blob();
    
    // Download the file
    saveAs(blob, 'Carbon_Footprint_Template.xlsx');
  } catch (error) {
    console.error('Error downloading template:', error);
    // Fallback: You might want to generate the template programmatically here
    // or show an error message to the user
  }
};
  const handleExcelDownload = async (
    response,
    setAllProjects,
    setFilteredProjects,
    setTopProjects,
    setError,
    businessName,
    plantName
  ) => {
    console.log('[ExcelDownload] Starting download...');
    console.log('[ExcelDownload] Incoming response:', response);

    try {
      if (!response?.fileInfo?.storage_path) {
        console.warn('[ExcelDownload] No storage path found in response.');
        setError('No project file available for this plant');
        return false;
      }

      console.log('[ExcelDownload] Downloading file from:', response.fileInfo.storage_path);
      const file = await downloadExcelFile(response.fileInfo.storage_path);
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      
      // Process Sheet2 (Projects)
      const projectsSheet = workbook.Sheets[workbook.SheetNames[1]]; // Sheet2 is at index 1
      const projects = XLSX.utils.sheet_to_json(projectsSheet);
      
      console.log(`[ExcelDownload] Loaded ${projects.length} projects`);
      
      // Clean and format project data
      const formattedProjects = projects.map(project => ({
        ...project,
        'Estimated Carbon Reduction in Kg/CO2 per annum': 
          parseFloat(project['Estimated Carbon Reduction in Kg/CO2 per annum'] || 0),
        'Estimated Investment in Rs.': 
          parseFloat(project['Estimated Investment in Rs.'] || 0),
        'Lead time for implementation in Months': 
          parseFloat(project['Lead time for implementation in Months'] || 0)
      }));

      setAllProjects(formattedProjects);
      setFilteredProjects(formattedProjects);
      
      // Create top projects list with proper number formatting
      const initialTop5 = formattedProjects
        .sort((a, b) => b['Estimated Carbon Reduction in Kg/CO2 per annum'] - 
                        a['Estimated Carbon Reduction in Kg/CO2 per annum'])
        .slice(0, 5)
        .map((p, i) => ({
          id: i + 1,
          name: p['Project Information in details'] || '--',
          reduction: (p['Estimated Carbon Reduction in Kg/CO2 per annum'] || 0).toFixed(2),
          investment: (p['Estimated Investment in Rs.'] || 0).toLocaleString(),
          TimeTaken: (p['Lead time for implementation in Months'] || 0).toString()
        }));
      
      setTopProjects(initialTop5);
      
      return true;
    } catch (err) {
      console.error('[ExcelDownload] Error:', err);
      setError(`Failed to load project data: ${err.message}`);
      return false;
    }
  };

  useEffect(() => {
    if (emissionsData && !initialEmissionsData) {
      setInitialEmissionsData({...emissionsData});
    }
  }, [emissionsData]);

  // Load businesses on mount
    useEffect(() => {
    const loadBusinesses = async () => {
      try {
        setLoading(prev => ({ ...prev, businesses: true }));
        setError('');
        const businesses = await getBusinesses();
        if (!Array.isArray(businesses)) {
          throw new Error('Invalid business data format');
        }
        setBusinesses(businesses);
      } catch (error) {
        console.error('Load error:', error);
        setError(`Failed to load businesses. ${error.message}`);
      } finally {
        setLoading(prev => ({ ...prev, businesses: false }));
      }
    };
    loadBusinesses();
  }, []);

  useEffect(() => {
  if (selectedBusiness) {
    const loadPlants = async () => {
      try {
        setLoading(prev => ({ ...prev, plants: true }));
        setError('');
        setSelectedPlant('');
        setEmissionsData(null);
        setRenewableData(null);
        // Reset projects data when business changes
        setAllProjects([]);
        setFilteredProjects([]);
        setTopProjects([
          { id: 1, name: '--', reduction: '--', investment: '--', TimeTaken: '--' },
          { id: 2, name: '--', reduction: '--', investment: '--', TimeTaken: '--' },
          { id: 3, name: '--', reduction: '--', investment: '--', TimeTaken: '--' },
          { id: 4, name: '--', reduction: '--', investment: '--', TimeTaken: '--' },
          { id: 5, name: '--', reduction: '--', investment: '--', TimeTaken: '--' }
        ]);
        
        const response = await getPlantData(selectedBusiness);
        if (!response.plants || !Array.isArray(response.plants)) {
          throw new Error('Invalid plants data format');
        }
        setPlants(response.plants);
      } catch (err) {
        setError('Failed to load plants');
        console.error('Plant load error:', err);
      } finally {
        setLoading(prev => ({ ...prev, plants: false }));
      }
    };
    loadPlants();
  }
}, [selectedBusiness]);

  useEffect(() => {
  if (selectedBusiness && selectedPlant) {
    const loadPlantData = async () => {
      try {
        setLoading(prev => ({ ...prev, plants: true, emissions: true, projects: true }));
        setError('');
        
        // Reset projects to loading state
        setTopProjects([
          { id: 1, name: 'Loading...', reduction: '--', investment: '--', TimeTaken: '--' },
          { id: 2, name: 'Loading...', reduction: '--', investment: '--', TimeTaken: '--' },
          { id: 3, name: 'Loading...', reduction: '--', investment: '--', TimeTaken: '--' },
          { id: 4, name: 'Loading...', reduction: '--', investment: '--', TimeTaken: '--' },
          { id: 5, name: 'Loading...', reduction: '--', investment: '--', TimeTaken: '--' }
        ]);

        const response = await getPlantData(selectedBusiness, selectedPlant);
        
        if (response.emissionsData) {
          setEmissionsData(response.emissionsData);
        }
        if (response.renewableData) {
          setRenewableData(response.renewableData);
        }
        
        // Make sure to pass all required parameters to handleExcelDownload
        await handleExcelDownload(
          response,
          setAllProjects,
          setFilteredProjects,
          setTopProjects,
          setError,
          selectedBusinessName,
          selectedPlantName
        );

        console.log('API Response:', response);
        if (response.emissionsData) {
          console.log('Emissions Data:', response.emissionsData);
          setEmissionsData(response.emissionsData);
        }
        if (response.renewableData) {
          console.log('Renewable Data:', response.renewableData);
          setRenewableData(response.renewableData);
}
        
      } catch (error) {
        console.error('Plant data load error:', error);
        setError('Failed to load plant data');
        // Reset to empty state on error
        setTopProjects([
          { id: 1, name: '--', reduction: '--', investment: '--', TimeTaken: '--' },
          { id: 2, name: '--', reduction: '--', investment: '--', TimeTaken: '--' },
          { id: 3, name: '--', reduction: '--', investment: '--', TimeTaken: '--' },
          { id: 4, name: '--', reduction: '--', investment: '--', TimeTaken: '--' },
          { id: 5, name: '--', reduction: '--', investment: '--', TimeTaken: '--' }
        ]);
      } finally {
        setLoading(prev => ({ ...prev, plants: false, emissions: false, projects: false }));
      }
    };
    loadPlantData();
  }
  
}, [selectedBusiness, selectedPlant]);

  // Store initial emissions data
  useEffect(() => {
    if (emissionsData && !initialEmissionsData) {
      setInitialEmissionsData({...emissionsData});
    }
  }, [emissionsData]);

  // Throttled parameter handlers
  const throttledHandleParamChange = useMemo(
    () => throttle((e) => {
      const { name, value } = e.target;
      dispatch({ 
        type: name === 'investment' ? 'UPDATE_INVESTMENT' : 'UPDATE_EMISSION',
        payload: value
      });
    }, 300),
    []
  );

  const handleDateChange = useCallback((date) => {
    dispatch({ type: 'UPDATE_DATE', payload: date });
  }, []);

  // Memoized chart data
  // Replace the current chartData memoization with this:
const chartData = useMemo(() => {
  if (!emissionsData) return [];

  const years = [2025, 2026, 2027, 2028, 2029, 2030];
  return years.map(year => {
    const scope1 = emissionsData[`scope1_${year}`] || 0;
    const scope2 = emissionsData[`scope2_${year}`] || 0;
    const total = scope1 + scope2;
    
    // Calculate reduction if we have initial data to compare against
    let reduction = null;
    if (initialEmissionsData) {
      const initialTotal = (initialEmissionsData[`scope1_${year}`] || 0) + 
                          (initialEmissionsData[`scope2_${year}`] || 0);
      reduction = initialTotal - total;
    }

    // Calculate target value if parameters are committed
    let targetValue = null;
    if (params.committed && params.carbonEmission) {
      targetValue = parseFloat(params.carbonEmission);
    }

    return {
      year,
      scope1,
      scope2,
      total,
      reduction,
      targetValue
    };
  });
}, [emissionsData, params, initialEmissionsData]);

  const renewableChartData = useMemo(() => {
    if (!renewableData) return [];
    const years = [2025, 2026, 2027, 2028, 2029, 2030];
    return years.map(year => ({
      year,
      solar: renewableData[`solar_${year}`] || 0,
      wind: renewableData[`wind_${year}`] || 0,
      others: renewableData[`others_${year}`] || 0,
      total: (renewableData[`solar_${year}`] || 0) + 
             (renewableData[`wind_${year}`] || 0) + 
             (renewableData[`others_${year}`] || 0)
    }));
  }, [renewableData]);

  const handleSubmitParams = async () => {
    try {
      setLoading(prev => ({ ...prev, projects: true }));
      setIsSubmitted(true);
      setCommittedParams({...params});
      
      // Show loading state for top projects
      setTopProjects([
        { id: 1, name: 'Loading...', reduction: '--', investment: '--', TimeTaken: '--' },
        { id: 2, name: 'Loading...', reduction: '--', investment: '--', TimeTaken: '--' },
        { id: 3, name: 'Loading...', reduction: '--', investment: '--', TimeTaken: '--' },
        { id: 4, name: 'Loading...', reduction: '--', investment: '--', TimeTaken: '--' },
        { id: 5, name: 'Loading...', reduction: '--', investment: '--', TimeTaken: '--' }
      ]);
      
      const { filteredProjects, topProjects, summary, message } = 
        await filterProjects(allProjects, {
          investment: params.investment,
          carbonEmission: params.carbonEmission,
          targetDate: params.targetDate.toISOString()
        });
      
      setTopProjects(topProjects);
      setFilteredProjects(filteredProjects);

      // Determine which label to show
      if (params.investment && params.carbonEmission) {
        // Both constraints - hide label
        setSummaryInfo({ type: null, value: null });
      } else if (params.investment) {
        // Only investment constraint - show carbon reduction
        setSummaryInfo({
          type: 'carbon',
          value: summary.totalCarbonReduction
        });
      } else if (params.carbonEmission) {
        // Only carbon constraint - show required investment
        setSummaryInfo({
          type: 'investment',
          value: summary.totalInvestment
        });
      }
      
      setEmissionsData(prev => ({...prev}));
      
      if (filteredProjects.length === 0) {
        alert(message || 'No projects matched your criteria. Try adjusting parameters.');
      } else {
        alert(`${filteredProjects.length} projects selected with total investment ₹${summary.totalInvestment.toLocaleString()}`);
      }
    } catch (error) {
      console.error('Optimization Error:', error);
      alert('Failed to optimize projects. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, projects: false }));
    }
  };

  const handleDownloadProjects = async () => {
    try {
      if (filteredProjects.length === 0) {
        alert('No projects to download');
        return;
      }
      setLoading(prev => ({ ...prev, download: true }));
      let businessName = selectedBusinessName;
      let plantName = selectedPlantName;
      if (!businessName || !plantName) {
        const businessObj = businesses.find(b => b.id === selectedBusiness);
        const plantObj = plants.find(p => p.id === selectedPlant);
        businessName = businessObj?.name || 'business';
        plantName = plantObj?.name || 'plant';
      }
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(
        filteredProjects.map(p => ({
          'Project': (p['Project Information in details']),
          'Category': p.Category,
          'Approach': p.Approach,
          'Carbon Reduction (Kg)': (p['Estimated Carbon Reduction in Kg/CO2 per annum']),
          'Investment (Rs.)': p['Estimated Investment in Rs.'],
          'Timeline': p['Lead time for implementation in Months'],
        }))
      );
      XLSX.utils.book_append_sheet(wb, ws, "Filtered Projects");
      const fileName = `FilteredProjects_${businessName}_${plantName}_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('Download failed:', error);
      alert(`Download error: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, download: false }));
    }
  };
  
  return (
  <div className={styles.dashboard}>
    <Header />
    <main className={styles.mainContent}>
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        {/* Business and Plant Name - Changed to text inputs */}
        <section className={styles.businessSection}>
          <div className={styles.inputCard}>
            <label className={styles.inputLabel}>
              <span className={styles.labelIcon}>🏢</span>
              Business Name
            </label>
            <input 
              {...register("businessName", { required: "Business name is required" })}
              type="text"
              placeholder="Enter business name"
              className={`${styles.inputField} ${errors.businessName ? styles.errorInput : ''}`}
            />
            {errors.businessName && <span className={styles.errorMessage}>{errors.businessName.message}</span>}
          </div>
          
          <div className={styles.inputCard}>
            <label className={styles.inputLabel}>
              <span className={styles.labelIcon}>🏭</span>
              Plant Name
            </label>
            <input 
              {...register("plantName", { required: "Plant name is required" })}
              type="text"
              placeholder="Enter plant name"
              className={`${styles.inputField} ${errors.plantName ? styles.errorInput : ''}`}
            />
            {errors.plantName && <span className={styles.errorMessage}>{errors.plantName.message}</span>}
          </div>
        </section>
        
        {/* Instructions and File Upload Section */}
        <section className={styles.instructionsSection}>
          <div className={styles.instructionsCard}>
            <h3>Instructions</h3>
            <ol className={styles.instructionsList}>
              <li>Download and use the template provided</li>
              <li>Don't change the column and row names in the template</li>
              <li>Fill the scope values and renewable values in Sheet1</li>
              <li>Fill the project details in Sheet2</li>
            </ol>
            <button 
              type="button" 
              onClick={downloadTemplate}
              className={styles.downloadButton}
            >
              <FiDownload className={styles.downloadIcon} />
              Download Template
            </button>
          </div>
          
          <div className={styles.uploadArea}>
            <div className={styles.uploadCard}>
              <h3>Upload Excel File</h3>
              <div className={styles.uploadBox}>
                <label className={styles.uploadLabel}>
                  <input 
                    type="file"
                    onChange={handleFileChange}
                    accept=".xlsx,.xls,.csv"
                    className={styles.fileInput}
                    disabled={!businessName?.trim() || !plantName?.trim()}
                  />
                  {file ? (
                    <div className={styles.filePreview}>
                      <p>Selected: {file.name}</p>
                      <p className={styles.fileSize}>
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div className={`${styles.uploadContent} ${
                      (!businessName?.trim() || !plantName?.trim()) ? styles.disabledUpload : ''
                    }`}>
                      <FiUpload className={styles.uploadIcon} />
                      <p className={styles.uploadText}>
                        {businessName?.trim() && plantName?.trim()
                          ? "Drag & drop your file here or click to browse"
                          : "Please enter Business and Plant names first"}
                      </p>
                      <p className={styles.uploadSubtext}>
                        {businessName?.trim() && plantName?.trim()
                          ? "Supports: .xlsx, .xls, .csv (Max 10MB)"
                          : "File upload will be enabled after basic info is entered"}
                      </p>
                    </div>
                  )}
                </label>
              </div>
            </div>
            
            <div className={styles.actionCard}>
              <button 
                type="submit" 
                className={styles.submitButton}
                disabled={isProcessing || !businessName?.trim() || !plantName?.trim()}
              >
                {isProcessing ? (
                  <div className={styles.spinner}></div>
                ) : (
                  'Save & Process Data'
                )}
              </button>
            </div>
          </div>
        </section>
      </form>

      {/* Dashboard Section - Placed below the form */}
      <div className={styles.dashboardSection}>
        <div className={styles.topSection}>
          <div className={styles.businessSelector}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Mention Company Details</h3>
            </div>
            <div className={styles.selectorGrid}>
              <div className={styles.inputGroup}>
                <label>
                  <FiBriefcase className={styles.inputIcon} />
                  Business Unit
                </label>
                <select
                  value={selectedBusiness}
                  onChange={(e) => setSelectedBusiness(e.target.value)}
                  className={styles.modernSelect}
                >
                  <option value="">Select Business</option>
                  {businesses.map(business => (
                    <option key={business.id} value={business.id}>{business.name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.inputGroup}>
                <label>
                  <FiPackage className={styles.inputIcon} />
                  Production Plant
                </label>
                <select
                  value={selectedPlant}
                  onChange={(e) => setSelectedPlant(e.target.value)}
                  className={styles.modernSelect}
                  disabled={!selectedBusiness || loading.plants}
                >
                  <option value="">
                    {loading.plants ? (
                      <span className={styles.loadingText}>
                        <FiLoader className={styles.spinner} /> Loading plants...
                      </span>
                    ) : selectedBusiness ? "Select Plant" : "Select Business First"}
                  </option>
                  {plants.map(plant => (
                    <option key={plant.id} value={plant.id}>{plant.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className={styles.constraintsCard}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Project Parameters</h3>
          </div>
          <div className={styles.constraintsForm}>
            <div className={styles.formRow}>
              <div className={styles.inputGroup}>
                <label>Target Year</label>
                <DatePicker
                  selected={params.targetDate}
                  onChange={handleDateChange}
                  dateFormat="MM/yyyy"
                  showMonthYearPicker
                  className={styles.yearInput}
                  placeholderText="Select month and year"
                  minDate={new Date()}
                />
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.inputGroup}>
                <label>Investment (₹)</label>
                <div className={styles.currencyInput}>
                  <span>₹</span>
                  <input
                    type="number"
                    name="investment"
                    value={params.investment}
                    onChange={throttledHandleParamChange}
                    placeholder="0.00"
                    min="0"
                  />
                </div>
              </div>
              <div className={styles.inputGroup}>
                <label>CO₂ Emission (Kg)</label>
                <input
                  type="number"
                  name="carbonEmission"
                  value={params.carbonEmission}
                  onChange={throttledHandleParamChange}
                  placeholder="0.00"
                  min="0"
                />
              </div>
            </div>
            <div className={styles.buttonGroup}>
  <button
    className={styles.saveButton}
    onClick={handleSubmitParams}
    disabled={!selectedBusiness || !selectedPlant || loading.submit}
  >
    {loading.submit ? (
      <FiLoader className={styles.spinner} />
    ) : (
      <>
        SUBMIT
        <FiArrowRight className={styles.buttonIcon} />
      </>
    )}
  </button>
  {summaryInfo.type && (
    <div className={styles.summaryLabel}>
      {summaryInfo.type === 'carbon' ? 'Reduced Carbon: ' : 'Required Investment: '}
      {summaryInfo.type === 'carbon' 
        ? `${summaryInfo.value.toLocaleString()} Kg/CO₂`
        : `₹${summaryInfo.value.toLocaleString()}`
      }
    </div>
  )}
</div>
          </div>
        </div>
      </div>
      
        {/* Dashboard Section - Placed below the form */}
<div className={styles.dashboardSection}>
  {/* ... existing topSection code ... */}

  {/* Create a container for the chart and table sections */}
  <div className={styles.chartAndTableContainer}>
    <div className={styles.chartSection}>
      <div className={styles.sectionHeader}>
        <h2>EMISSIONS OVERVIEW</h2>
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={styles.legendColor + ' ' + styles.scope1}></span>
            <span>Scope 1</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendColor + ' ' + styles.scope2}></span>
            <span>Scope 2</span>
          </div>
        </div>
      </div>
      <div className={styles.chartWrapper}>
        <EmissionsChart 
          data={chartData} 
          loading={loading.emissions} 
        />
      </div>
    </div>

    <div className={styles.tableSection}>
      <div className={styles.sectionHeader}>
        <h2>TOP PROJECTS</h2>
        <span className={styles.units}>potential impact</span>
        <button 
          onClick={handleDownloadProjects}
          className={styles.downloadButton}
          disabled={topProjects[0].name === '--' || loading.download}
        >
          {loading.download ? (
            <FiLoader className={styles.spinner} />
          ) : (
            <>
              <FiDownload className={styles.downloadIcon} />
              Download List
            </>
          )}
        </button>
      </div>
      <div className={styles.tableWrapper}>
        <table className={styles.projectsTable}>
          <thead>
            <tr>
              <th>#</th>
              <th>Project Name</th>
              <th>Reduction (Kgs)</th>
              <th>Investment (₹)</th>
              <th>Time Taken</th>
            </tr>
          </thead>
          <tbody>
            {topProjects.map((project) => (
              <tr key={project.id}>
                <td>{project.id}</td>
                <td>{project.name}</td>
                <td>{project.reduction}</td>
                <td>{project.investment}</td>
                <td>{project.TimeTaken}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
</div>
    </main>
    <Footer />
    {showSuccess && (
        <div className={styles.successPopup}>
          <div className={styles.successContent}>
            <div className={styles.successIcon}>✓</div>
            <div className={styles.successText}>Data Saved Successfully!</div>
          </div>
        </div>
      )}
  </div>
);
};
export default CarbonFootprintPage;