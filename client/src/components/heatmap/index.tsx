import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Button, Form, Modal } from 'react-bootstrap';
import './style.css';
import { getScanData } from './getData';

// Heatmap.js type definitions
interface HeatmapDataPoint {
  x: number;
  y: number;
  value: number;
}

interface HeatmapData {
  max: number;
  min: number;
  data: HeatmapDataPoint[];
}

interface HeatmapConfig {
  container: HTMLElement;
  radius?: number;
  maxOpacity?: number;
  minOpacity?: number;
  blur?: number;
  gradient?: Record<string, string>;
}

interface HeatmapInstance {
  setData(data: HeatmapData): HeatmapInstance;
  addData(dataPoint: HeatmapDataPoint | HeatmapDataPoint[]): HeatmapInstance;
  configure(config: Partial<HeatmapConfig>): HeatmapInstance;
  getValueAt(point: { x: number; y: number }): number;
  getData(): HeatmapData;
  getDataURL(): string;
  repaint(): HeatmapInstance;
}

interface HeatmapFactory {
  create(config: HeatmapConfig): HeatmapInstance;
}

declare global {
  interface Window {
    h337: HeatmapFactory;
  }
}

function HeatMapPage() {
  const [showMapUpload, setShowMapUpload] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const heatmapContainerRef = useRef<HTMLDivElement>(null);
  const heatmapInstanceRef = useRef<HeatmapInstance | null>(null);



  // Function to initialize and display heatmap with API data
  const initializeHeatmap = async () => {
    // Don't initialize if heatmap already exists
    if (heatmapInstanceRef.current) return;

    // Load heatmap.js library dynamically
    if (!window.h337 && heatmapContainerRef.current) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/gh/pa7/heatmap.js@master/build/heatmap.min.js';
      script.onload = () => {
        createHeatmapInstance();
      };
      document.body.appendChild(script);
    } else if (window.h337 && heatmapContainerRef.current) {
      createHeatmapInstance();
    }
  };

  // Function to create heatmap instance with API data
  const createHeatmapInstance = async () => {
    if (!window.h337 || !heatmapContainerRef.current) return;

    // Create heatmap configuration
    const config: HeatmapConfig = {
      container: heatmapContainerRef.current,
      radius: 20,
      maxOpacity: 0.8,
      minOpacity: 0,
      blur: 0.75,
      gradient: {
        '.4': 'blue',
        '.6': 'cyan',
        '.7': 'lime',
        '.8': 'yellow',
        '1.0': 'red'
      }
    };

    // Create heatmap instance
    const heatmapInstance = window.h337.create(config);
    heatmapInstanceRef.current = heatmapInstance;

    // Fetch scan data from API
    const wifiScans = await getScanData();
    
    // Transform WiFi scan data into heatmap data points
    // Note: RSSI values are typically negative (-100 to 0), we'll normalize them
    const heatmapPoints: HeatmapDataPoint[] = [];
    
    if (wifiScans.length > 0) {
      // Get container dimensions for positioning
      const container = heatmapContainerRef.current;
      const containerWidth = container.offsetWidth || 800;
      const containerHeight = container.offsetHeight || 600;
      
      // Group scans by endpoint_id to position them
      const endpointGroups = new Map<string, typeof wifiScans>();
      wifiScans.forEach(scan => {
        if (!endpointGroups.has(scan.endpoint_id)) {
          endpointGroups.set(scan.endpoint_id, []);
        }
        endpointGroups.get(scan.endpoint_id)!.push(scan);
      });
      
      // Create heatmap points from scan data
      let xOffset = 0;
      const endpointCount = endpointGroups.size;
      const xSpacing = containerWidth / Math.max(endpointCount, 1);
      
      endpointGroups.forEach((scans, endpointId) => {
        scans.forEach((scan, index) => {
          // Normalize RSSI to a positive value (0-100 scale)
          // RSSI ranges from -100 (weak) to 0 (strong), convert to 0-100
          const normalizedValue = Math.max(0, Math.min(100, scan.rssi + 100));
          
          // Calculate x position based on endpoint
          const x = xOffset + (index % 10) * (xSpacing / 10);
          
          // Calculate y position based on scan index (distribute vertically)
          const y = (index * (containerHeight / Math.max(scans.length, 1))) % containerHeight;
          
          heatmapPoints.push({
            x: Math.round(x),
            y: Math.round(y),
            value: normalizedValue
          });
        });
        xOffset += xSpacing;
      });
      
      // Find min and max values for heatmap
      const values = heatmapPoints.map(point => point.value);
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      
      const data: HeatmapData = {
        max: maxValue,
        min: minValue,
        data: heatmapPoints
      };
      
      heatmapInstance.setData(data);
    } else {
      // If no data, set empty heatmap
      const data: HeatmapData = {
        max: 100,
        min: 0,
        data: []
      };
      heatmapInstance.setData(data);
    }
  };

  useEffect(() => {
    // .then is the syntax for getting the data from the promise
    getScanData().then(data => {
      console.log(data);
    });
  }, []);

  // Initialize heatmap only after image is uploaded
  useEffect(() => {
    if (uploadedImage) {
      initializeHeatmap();
    }

    // Cleanup function
    return () => {
      if (heatmapInstanceRef.current) {
        // Cleanup if needed
        heatmapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedImage]);

  // Handle file selection (store file but don't process yet)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
      console.log('Selected file:', file.name, 'Type:', file.type);
      setSelectedFile(file);
    }
  };

  // Handle upload button click - process the selected file
  const handleUploadClick = () => {
    if (selectedFile) {
      // Reset previous uploads
      setUploadedImage(null);
      setFileType(null);
      
      // Check if it's an image file
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          setUploadedImage(result);
          setFileType('image');
        };
        reader.readAsDataURL(selectedFile);
      } else if (selectedFile.type === 'application/pdf') {
        // Handle PDF file
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          setUploadedImage(result);
          setFileType('pdf');
        };
        reader.readAsDataURL(selectedFile);
      } else {
        console.log('Unsupported file type:', selectedFile.type);
        alert('Unsupported file type. Please upload JPG or PDF files.');
      }
      
      // Close modal after upload
      setShowMapUpload(false);
    }
  };

  return (
    <Container fluid className='heatmap-page'>
      <Row className='heatmap-row'>
        <Col className='information-container' lg={3}>
          <div className='top-content'>
            <div className='button-container'>
              <Button className='info-button'>Settings</Button>
              
              <Button className='info-button' onClick={() => setShowMapUpload(true)}>Change Map</Button>
              <Modal show={showMapUpload} onHide={() => setShowMapUpload(false)} centered className='modal-map-upload'>
                <Modal.Header className='modal-map-upload-header'>
                  <Modal.Title className='modal-map-upload-title'>Upload Map</Modal.Title>
                </Modal.Header>
                <Modal.Body className='modal-map-upload-body'>
                  <Form.Group className="mb-3">
                    <Form.Label>Select Map File</Form.Label>
                    <Form.Control
                      type="file"
                      accept="image/jpeg,image/png,image/jpg,application/pdf"
                      onChange={handleFileUpload}
                    />
                    <Form.Text className="text-muted">
                      Supported formats: JPG, PNG, PDF
                    </Form.Text>
                  </Form.Group>
                  <div className="d-flex justify-content-center gap-4">
                    <Button 
                      variant="primary" 
                      className="upload-btn"
                      onClick={handleUploadClick}
                      disabled={!selectedFile}
                    >
                      Upload Map
                    </Button>
                    <Button variant="secondary" className="cancel-btn" onClick={() => setShowMapUpload(false)}>
                      Cancel
                    </Button>
                  </div>
                </Modal.Body>
              </Modal>

            </div>
            <Row className='endpoint-info'>
              <p>Endpoint info goes here</p>
            </Row>
          </div>
        </Col>
        <Col className='heatmap-container' lg={9}>
          {!uploadedImage && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              color: '#666',
              fontSize: '18px',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <p>Upload a map to display the heatmap</p>
              <Button 
                className='info-button' 
                onClick={() => setShowMapUpload(true)}
                style={{ maxWidth: '300px' }}
              >
                Upload Map
              </Button>
            </div>
          )}
          {uploadedImage && fileType === 'image' && (
            <img 
              src={uploadedImage} 
              alt="Map" 
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'fill',
                opacity: 0.7,
                zIndex: 1,
                pointerEvents: 'none'
              }}
            />
          )}
          {uploadedImage && fileType === 'pdf' && (
            <iframe 
              src={uploadedImage} 
              title="Map PDF"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none',
                opacity: 0.7,
                zIndex: 1,
                pointerEvents: 'none'
              }}
            />
          )}
          <div ref={heatmapContainerRef} style={{ width: '100%', height: '100%', position: 'relative', zIndex: 2 }}></div>
        </Col>
      </Row>
    </Container>
  );
}

export default HeatMapPage;
