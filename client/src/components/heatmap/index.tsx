import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Button, Form, Dropdown, Alert, Modal } from 'react-bootstrap';
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
  const [serverIP, setServerIP] = useState('');
  const [previousEntries, setPreviousEntries] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [showMapUpload, setShowMapUpload] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const heatmapContainerRef = useRef<HTMLDivElement>(null);
  const heatmapInstanceRef = useRef<HeatmapInstance | null>(null);



  // Function to initialize and display heatmap with hardcoded example data
  const initializeHeatmap = () => {
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

  // Function to create heatmap instance with hardcoded example data
  const createHeatmapInstance = () => {
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

    // Hardcoded example data points (will be replaced with API data later)
    const exampleData = {
      max: 100,
      min: 0,
      data: [
        { x: 100, y: 100, value: 90 },
        { x: 200, y: 150, value: 75 },
        { x: 300, y: 200, value: 60 },
        { x: 400, y: 100, value: 85 },
        { x: 500, y: 250, value: 70 },
        { x: 600, y: 300, value: 95 },
        { x: 300, y: 350, value: 50 },
        { x: 150, y: 200, value: 80 },
        { x: 250, y: 300, value: 65 },
        { x: 450, y: 350, value: 75 },
        { x: 550, y: 180, value: 90 },
        { x: 180, y: 280, value: 55 },
        { x: 650, y: 400, value: 70 },
        { x: 700, y: 180, value: 85 },
        { x: 380, y: 380, value: 60 }
      ]
    };

    // Set the data to display the heatmap
    heatmapInstance.setData(exampleData);
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

  // API function to send data to Postman mock endpoint
  const sendToAPI = async (ip: string) => {
    try {
      setIsLoading(true);
      setMessage(null);
      
      const response = await fetch('https://d9bbb8ed-6446-4926-a327-b313008215e9.mock.pstmn.io/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serverIP: ip }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('API Response:', data);
        
        // Only add to previous entries on successful API response
        setPreviousEntries(prev => {
          if (!prev.includes(ip)) {
            return [...prev, ip];
          }
          return prev;
        });
        
        setMessage({ type: 'success', text: `Server IP "${ip}" sent to API successfully!` });
      } else {
        console.error('API Error:', response.status, response.statusText);
        setMessage({ type: 'error', text: `API Error: ${response.status} ${response.statusText}` });
      }
    } catch (error) {
      console.error('Error sending data to API:', error);
      setMessage({ type: 'error', text: 'Failed to connect to server.' });
    } finally {
      setIsLoading(false);
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (serverIP.trim()) {
      sendToAPI(serverIP.trim());
    }
  };

  // Handle dropdown selection
  const handleDropdownSelect = (selectedIP: string) => {
    setServerIP(selectedIP);
  };

  // Handle file selection (store file but don't process yet)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
      console.log('Selected file:', file.name, 'Type:', file.type);
      setSelectedFile(file);
      // Clear any previous error messages
      setMessage(null);
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
        setMessage({ type: 'error', text: 'Unsupported file type. Please upload JPG or PDF files.' });
        setTimeout(() => setMessage(null), 3000);
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
          <Row className='server-ip'>
            <Form onSubmit={handleSubmit}>
              {message && (
                <Alert variant={message.type === 'success' ? 'success' : 'danger'} className="mb-3">
                  {message.text}
                </Alert>
              )}
              <Form.Group className="mb-3">
                <Form.Label>Server IP</Form.Label>
                <div className="input-group">
                  <Form.Control
                    type="text"
                    placeholder="Enter Server IP"
                    value={serverIP}
                    onChange={(e) => setServerIP(e.target.value)}
                    required
                  />
                  <Dropdown>
                    <Dropdown.Toggle variant="outline-secondary" id="dropdown-basic">
                      Saved Server IP's
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      {previousEntries.length > 0 ? (
                        previousEntries.map((entry, index) => (
                          <Dropdown.Item 
                            key={index} 
                            onClick={() => handleDropdownSelect(entry)}
                          >
                            {entry}
                          </Dropdown.Item>
                        ))
                      ) : (
                        <Dropdown.Item className='disabled' disabled>No previous entries</Dropdown.Item>
                      )}
                    </Dropdown.Menu>
                  </Dropdown>
                </div>
              </Form.Group>
              <Button 
                type="submit" 
                variant="primary" 
                disabled={isLoading}
                className="w-100"
              >
                {isLoading ? 'Sending...' : 'Set Server IP'}
              </Button>
            </Form>
          </Row>
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
