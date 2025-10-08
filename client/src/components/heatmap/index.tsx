import { Container, Row, Col, Button } from 'react-bootstrap';
import './style.css';

function HeatMapPage() {
  return (
    <Container fluid className='heatmap-page'>
      <Row className='heatmap-row'>
        <Col className='information-container' lg={3}>
          <div className='button-container'>
            <Button className='info-button'>Settings</Button>
            <Button className='info-button'>Change Map</Button>
          </div>
          <Row className='endpoint-info'>
            <p>Endpoint info goes here</p>
          </Row>
          <Row className='server-ip'>
            <form>
              <input type='text' placeholder='Server IP' />
              <Button>Save</Button>
            </form>
          </Row>
        </Col>
        <Col className='heatmap-container' lg={9}>
          <h1>Heatmap area</h1>
        </Col>
      </Row>
    </Container>
  );
}

export default HeatMapPage;
