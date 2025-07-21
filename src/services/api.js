import supabase from './supabase';
import * as XLSX from 'xlsx';

// Business and Plant Operations
export const getBusinesses = async () => {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching businesses:', error);
    throw error;
  }
};

export const getPlantData = async (businessId, plantId = null) => {
  try {
    if (plantId) {
      // Get complete plant data including emissions and file
      const { data: plantData, error: plantError } = await supabase
        .from('plants')
        .select(`
          id, 
          name, 
          business:businesses(name),
          emissions_data:emissions_data!plant_id(
            scope1inkgs_2025, scope2inkgs_2025,
            scope1inkgs_2026, scope2inkgs_2026,
            scope1inkgs_2027, scope2inkgs_2027,
            scope1inkgs_2028, scope2inkgs_2028,
            scope1inkgs_2029, scope2inkgs_2029,
            scope1inkgs_2030, scope2inkgs_2030,
            solarinpercentage_2025, windinpercentage_2025, othersinpercentage_2025,
            solarinpercentage_2026, windinpercentage_2026, othersinpercentage_2026,
            solarinpercentage_2027, windinpercentage_2027, othersinpercentage_2027,
            solarinpercentage_2028, windinpercentage_2028, othersinpercentage_2028,
            solarinpercentage_2029, windinpercentage_2029, othersinpercentage_2029,
            solarinpercentage_2030, windinpercentage_2030, othersinpercentage_2030
          ),
          project_files:project_files!plant_id(
            original_filename, 
            storage_path, 
            uploaded_at
          )
        `)
        .eq('id', plantId)
        .single();

      if (plantError) throw plantError;

      console.log('Plant Data from Supabase:', plantData);

      // Extract emissions and renewable data from the emissions_data table
      const emissionsData = plantData.emissions_data || null;
      
      return {
        businessName: plantData.business?.name || '',
        plantName: plantData.name,
        emissionsData: emissionsData ? {
          scope1_2025: emissionsData.scope1inkgs_2025,
          scope1_2026: emissionsData.scope1inkgs_2026,
          scope1_2027: emissionsData.scope1inkgs_2027,
          scope1_2028: emissionsData.scope1inkgs_2028,
          scope1_2029: emissionsData.scope1inkgs_2029,
          scope1_2030: emissionsData.scope1inkgs_2030,
          scope2_2025: emissionsData.scope2inkgs_2025,
          scope2_2026: emissionsData.scope2inkgs_2026,
          scope2_2027: emissionsData.scope2inkgs_2027,
          scope2_2028: emissionsData.scope2inkgs_2028,
          scope2_2029: emissionsData.scope2inkgs_2029,
          scope2_2030: emissionsData.scope2inkgs_2030
        } : null,
        renewableData: emissionsData ? {
          solar_2025: emissionsData.solarinpercentage_2025,
          solar_2026: emissionsData.solarinpercentage_2026,
          solar_2027: emissionsData.solarinpercentage_2027,
          solar_2028: emissionsData.solarinpercentage_2028,
          solar_2029: emissionsData.solarinpercentage_2029,
          solar_2030: emissionsData.solarinpercentage_2030,
          wind_2025: emissionsData.windinpercentage_2025,
          wind_2026: emissionsData.windinpercentage_2026,
          wind_2027: emissionsData.windinpercentage_2027,
          wind_2028: emissionsData.windinpercentage_2028,
          wind_2029: emissionsData.windinpercentage_2029,
          wind_2030: emissionsData.windinpercentage_2030,
          others_2025: emissionsData.othersinpercentage_2025,
          others_2026: emissionsData.othersinpercentage_2026,
          others_2027: emissionsData.othersinpercentage_2027,
          others_2028: emissionsData.othersinpercentage_2028,
          others_2029: emissionsData.othersinpercentage_2029,
          others_2030: emissionsData.othersinpercentage_2030
        } : null,
        fileInfo: plantData.project_files?.[0] || null
      };
    } else {
      // Get all plants for business (no emissions or file data)
      const { data: plants, error: plantsError } = await supabase
        .from('plants')
        .select('id, name')
        .eq('business_id', businessId)
        .order('name', { ascending: true });

      if (plantsError) throw plantsError;

      return {
        plants: plants || [],
        businessName: '',
        plantName: '',
        emissionsData: null,
        renewableData: null,
        fileInfo: null
      };
    }
  } catch (error) {
    console.error('Error fetching plant data:', error);
    throw error;
  }
};

// Data Saving Operations
export const saveData = async (formData) => {
  try {
    const businessName = formData.get('businessName');
    const plantName = formData.get('plantName');
    const date = new Date().toISOString();

    // Upsert business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .upsert({ name: businessName }, { onConflict: 'name' })
      .select()
      .single();

    if (businessError) throw businessError;

    // Upsert plant
    const { data: plant, error: plantError } = await supabase
      .from('plants')
      .upsert({ 
        business_id: business.id, 
        name: plantName 
      }, { onConflict: 'business_id,name' })
      .select()
      .single();

    if (plantError) throw plantError;

    return { 
      success: true,
      businessId: business.id,
      plantId: plant.id 
    };
  } catch (error) {
    console.error('Save error:', error);
    return { success: false, error: error.message };
  }
};

// File Operations
export const uploadExcelFile = async (file, plantId, progressCallback) => {
  try {
    // Generate a unique filename to prevent conflicts
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    // Upload file to storage
    const { data, error: uploadError } = await supabase
      .storage
      .from('project-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
        onUploadProgress: (progress) => {
          const progressPercent = (progress.loaded / progress.total) * 100;
          progressCallback(progressPercent);
        }
      });

    if (uploadError) throw uploadError;

    // Save file metadata to database
    const { error: dbError } = await supabase
      .from('plant_files')
      .insert({
        plant_id: plantId,
        original_filename: file.name,
        storage_path: filePath
      });

    if (dbError) throw dbError;

    return { 
      success: true, 
      filePath,
      originalFilename: file.name 
    };
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

export const downloadExcelFile = async (storagePath) => {
  try {
    const { data, error } = await supabase
      .storage
      .from('carbon-footprint')
      .download(storagePath);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
};

export const getLatestPlantFile = async (plantId) => {
  try {
    const { data, error } = await supabase
      .from('plant_files')
      .select('original_filename, storage_path, uploaded_at')
      .eq('plant_id', plantId)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching plant file:', error);
    return null;
  }
};

// Helper function to process Excel file data
export const processExcelData = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Process sheet 1 (scope and renewable data)
        const scopeSheet = workbook.Sheets[workbook.SheetNames[0]];
        const scopeData = XLSX.utils.sheet_to_json(scopeSheet);
        
        // Process sheet 2 (project data)
        const projectsSheet = workbook.Sheets[workbook.SheetNames[1]];
        const projectsData = XLSX.utils.sheet_to_json(projectsSheet);
        
        resolve({
          scopeData,
          projectsData
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};