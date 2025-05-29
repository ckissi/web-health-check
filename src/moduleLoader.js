import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Dynamically loads health check modules
 * @param {string|string[]} moduleNames - 'all' or array of module names to load
 * @returns {Object} - Object with module name as key and module function as value
 */
export async function loadModules(moduleNames = 'all') {
  const modulesDir = path.join(__dirname, '../modules');
  const modules = {};
  
  try {
    // Get all module files
    const files = await fs.readdir(modulesDir);
    const moduleFiles = files.filter(file => file.endsWith('.js'));
    
    // Determine which modules to load
    const modulesToLoad = moduleNames === 'all' 
      ? moduleFiles.map(file => path.basename(file, '.js'))
      : Array.isArray(moduleNames) ? moduleNames : [moduleNames];
    
    // Load each module
    for (const moduleName of modulesToLoad) {
      const modulePath = path.join(modulesDir, `${moduleName}.js`);
      
      try {
        // Check if module file exists
        await fs.access(modulePath);
        
        // Import the module
        const module = await import(`../modules/${moduleName}.js`);
        
        // Add module to the modules object
        if (module.default && typeof module.default === 'function') {
          modules[moduleName] = module.default;
        }
      } catch (error) {
        console.warn(`Warning: Module '${moduleName}' not found or could not be loaded.`);
      }
    }
    
    return modules;
  } catch (error) {
    // If modules directory doesn't exist, create it
    if (error.code === 'ENOENT') {
      await fs.mkdir(modulesDir, { recursive: true });
      return {};
    }
    throw error;
  }
}
