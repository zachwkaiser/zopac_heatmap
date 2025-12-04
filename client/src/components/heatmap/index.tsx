import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Button, Form, Modal } from 'react-bootstrap';
import './style.css';
import { getScanData } from './getData';

// API base URL from environment variable, fallback to localhost for development
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

interface EndpointPosition {
  endpoint_id: string;
  x: number;
  y: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function HeatMapPage() {
  const [showMapUpload, setShowMapUpload] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(() => {
    // Load saved image from localStorage on initial render
    return localStorage.getItem('heatmap_background_image');
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointPosition[]>([]);
  const [_message, _setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draggingEndpoint, setDraggingEndpoint] = useState<string | null>(null);
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

  // Function to create heatmap instance and fetch data from API
  // Function to fetch and update heatmap data
  const updateHeatmapData = async () => {
    if (!heatmapInstanceRef.current) return;

    try {
      const response = await fetch(`${API_URL}/api/query/heatmap-data`);
      const result = await response.json();
      
      if (result.success && result.data) {
        // Update the heatmap with new data
        heatmapInstanceRef.current.setData(result.data);
        console.log('Heatmap data updated:', result.count, 'points');
      } else {
        console.error('Failed to load heatmap data:', result.error);
      }
    } catch (error) {
      console.error('Error fetching heatmap data:', error);
    }
  };

  const createHeatmapInstance = async () => {
    if (!window.h337 || !heatmapContainerRef.current) return;

    // Create heatmap configuration with blob-like appearance
    const config: HeatmapConfig = {
      container: heatmapContainerRef.current,
      radius: 50, // Larger radius for blob-like appearance
      maxOpacity: 0.8,
      minOpacity: 0.1,
      blur: 0.85, // Higher blur for smoother blobs
      gradient: {
        '0.0': 'green',    // Low density
        '0.5': 'yellow',   // Medium density
        '1.0': 'red'       // High density
      }
    };

    // Create heatmap instance
    const heatmapInstance = window.h337.create(config);
    heatmapInstanceRef.current = heatmapInstance;

    // Initial data fetch
    await updateHeatmapData();
  };

  useEffect(() => {
    // .then is the syntax for getting the data from the promise
    getScanData().then(data => {
      console.log(data);
    });
  }, []);

  // Fetch endpoint positions on component mount
  useEffect(() => {
    const fetchEndpoints = async () => {
      try {
        const response = await fetch(`${API_URL}/api/query/endpoints`);
        const data = await response.json();
        if (data.success && data.positions) {
          setEndpoints(data.positions);
        }
      } catch (error) {
        console.error('Error fetching endpoint positions:', error);
      }
    };
    fetchEndpoints();
  }, []);

  // Fetch floorplan from server on component mount
  useEffect(() => {
    const fetchFloorplan = async () => {
      try {
        const response = await fetch(`${API_URL}/api/floorplan?floor=1`);
        const data = await response.json();
        if (data.success && data.floorplan && data.floorplan.image_data) {
          setUploadedImage(data.floorplan.image_data);
          setFileType('image');
          console.log('Floorplan loaded from server');
        }
      } catch (error) {
        console.error('Error fetching floorplan:', error);
      }
    };
    fetchFloorplan();
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

  // Auto-refresh heatmap data every 5 seconds
  useEffect(() => {
    if (!heatmapInstanceRef.current) return;

    const intervalId = setInterval(() => {
      updateHeatmapData();
    }, 10000); // Update every 10 seconds

    return () => {
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heatmapInstanceRef.current]);

  // Handle modal close - reset selected file
  const handleCloseModal = () => {
    setShowMapUpload(false);
    setSelectedFile(null);
  };

  // Handle file selection (store file but don't process yet)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
      console.log('Selected file:', file.name, 'Type:', file.type);
      setSelectedFile(file);
    }
  };

  // Handle endpoint drag start
  const handleEndpointMouseDown = (endpointId: string, e: React.MouseEvent) => {
    if (!editMode) return;
    e.preventDefault();
    setDraggingEndpoint(endpointId);
  };

  // Handle endpoint dragging
  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (!draggingEndpoint || !heatmapContainerRef.current) return;
    
    const rect = heatmapContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setEndpoints(prev => 
      prev.map(ep => 
        ep.endpoint_id === draggingEndpoint 
          ? { ...ep, x: Math.max(0, Math.min(rect.width, x)), y: Math.max(0, Math.min(rect.height, y)) }
          : ep
      )
    );
  };

  // Handle endpoint drag end
  const handleContainerMouseUp = async () => {
    if (!draggingEndpoint) return;

    const endpoint = endpoints.find(ep => ep.endpoint_id === draggingEndpoint);
    if (endpoint) {
      try {
        // Update endpoint position on server using client proxy
        const response = await fetch(`${API_URL}/api/client/positions`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint_id: endpoint.endpoint_id,
            x: Math.round(endpoint.x),
            y: Math.round(endpoint.y),
          }),
        });

        const data = await response.json();
        if (data.success) {
          console.log('Endpoint position updated:', endpoint.endpoint_id);
        } else {
          console.error('Failed to update endpoint position:', data.error);
        }
      } catch (error) {
        console.error('Error updating endpoint position:', error);
      }
    }

    setDraggingEndpoint(null);
  };

  // Handle upload button click - upload the image to server
  const handleUploadClick = async () => {
    if (selectedFile) {
      // Reset previous uploads
      setUploadedImage(null);
      setFileType(null);
      
      // Check if it's an image file
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const result = event.target?.result as string;
          
          try {
            // Upload to server
            const response = await fetch(`${API_URL}/api/floorplan`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                floor: 1,
                name: selectedFile.name,
                image_data: result,
              }),
            });

            const data = await response.json();
            
            if (data.success) {
              console.log('Floorplan uploaded to server:', data.floorplan);
              // Set the uploaded image for display
              setUploadedImage(result);
              setFileType('image');
              _setMessage({ type: 'success', text: 'Floorplan uploaded successfully!' });
              setTimeout(() => _setMessage(null), 3000);
            } else {
              console.error('Failed to upload floorplan:', data.error);
              _setMessage({ type: 'error', text: 'Failed to upload floorplan to server.' });
              setTimeout(() => _setMessage(null), 3000);
            }
          } catch (error) {
            console.error('Error uploading floorplan:', error);
            _setMessage({ type: 'error', text: 'Error connecting to server.' });
            setTimeout(() => _setMessage(null), 3000);
          }
        };
        reader.readAsDataURL(selectedFile);
      } else if (selectedFile.type === 'application/pdf') {
        // Handle PDF file
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          setUploadedImage(result);
          setFileType('pdf');
          // Save to localStorage for persistence across page refreshes
          localStorage.setItem('heatmap_background_image', result);
          localStorage.setItem('heatmap_file_type', 'pdf');
        };
        reader.readAsDataURL(selectedFile);
      } else {
        console.log('Unsupported file type:', selectedFile.type);
        alert('Unsupported file type. Please upload JPG or PDF files.');
      }
      
      // Close modal and reset selected file after upload
      handleCloseModal();
    }
  };

  return (
    <Container fluid className='heatmap-page'>
      <Row className='heatmap-row'>
        <Col className='information-container' lg={3}>
          <div className='top-content'>
            <div className='button-container'>
              <Button className='info-button' onClick={() => setShowMapUpload(true)}>Change Map</Button>
              <Button 
                className={editMode ? 'info-button active' : 'info-button'} 
                onClick={() => setEditMode(!editMode)}
                style={{
                  backgroundColor: editMode ? '#28a745' : undefined,
                  borderColor: editMode ? '#28a745' : undefined
                }}
              >
                {editMode ? '✓ Edit Mode' : 'Edit Endpoints'}
              </Button>
              <Modal show={showMapUpload} onHide={handleCloseModal} centered className='modal-map-upload'>
                <Modal.Header closeButton className='modal-map-upload-header'>
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
                      title={!selectedFile ? "Please select a file first" : "Upload the selected map"}
                    >
                      Upload Map
                    </Button>
                    <Button variant="secondary" className="cancel-btn" onClick={handleCloseModal}>
                      Cancel
                    </Button>
                  </div>
                </Modal.Body>
              </Modal>

            </div>
            <Row className='endpoint-info'>
              <h5>Endpoint Information</h5>
              {endpoints.length === 0 ? (
                <p>No endpoints configured</p>
              ) : (
                <div className="endpoint-list">
                  {endpoints.map((endpoint) => (
                    <div key={endpoint.endpoint_id} className="endpoint-item">
                      <strong>{endpoint.endpoint_id}</strong>: 
                      Position ({endpoint.x}, {endpoint.y}) - 
                      <span className={endpoint.is_active ? 'status-active' : 'status-inactive'}>
                        {endpoint.is_active ? ' ✓ Active' : ' ✗ Inactive'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
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
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
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
          <div 
            ref={heatmapContainerRef} 
            style={{ width: '100%', height: '100%', position: 'relative', zIndex: 2 }}
            onMouseMove={handleContainerMouseMove}
            onMouseUp={handleContainerMouseUp}
            onMouseLeave={handleContainerMouseUp}
          >
            {/* Render endpoint markers */}
            {endpoints.map((endpoint) => (
              <div
                key={endpoint.endpoint_id}
                onMouseDown={(e) => handleEndpointMouseDown(endpoint.endpoint_id, e)}
                style={{
                  position: 'absolute',
                  left: `${endpoint.x}px`,
                  top: `${endpoint.y}px`,
                  width: editMode ? '20px' : '12px',
                  height: editMode ? '20px' : '12px',
                  borderRadius: '50%',
                  backgroundColor: editMode && draggingEndpoint === endpoint.endpoint_id ? '#666' : 'black',
                  border: `2px solid ${endpoint.is_active ? '#00ff00' : '#ff0000'}`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 10,
                  boxShadow: endpoint.is_active 
                    ? '0 0 8px 2px rgba(0,255,0,0.8), 0 0 12px 4px rgba(0,255,0,0.4)'
                    : '0 0 8px 2px rgba(255,0,0,0.8), 0 0 12px 4px rgba(255,0,0,0.4)',
                  pointerEvents: editMode ? 'auto' : 'none',
                  cursor: editMode ? 'move' : 'default',
                  transition: editMode ? 'none' : 'all 0.2s ease'
                }}
                title={`${endpoint.endpoint_id} - ${endpoint.is_active ? 'Active' : 'Inactive'}${editMode ? ' (Drag to move)' : ''}`}
              >
                {editMode && (
                  <div style={{
                    position: 'absolute',
                    top: '-25px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.8)',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none'
                  }}>
                    {endpoint.endpoint_id}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Col>
      </Row>
    </Container>
  );
}

export default HeatMapPage;

