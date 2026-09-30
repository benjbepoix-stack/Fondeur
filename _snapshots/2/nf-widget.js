
    var nordic_widget_option = {
        url: 'https://www.nordicfrance.fr',
        action_station: '/widget/marqueblanche/station/',
        action_association: '/widget/marqueblanche/association/',
        action_bulletin: '/widget/marqueblanche/association/station/'
    };
    
    function handlersStation() 
    {
        const sectors = document.querySelectorAll('.NordicDetail-secteurHeader');
        sectors.forEach(sector => {
            sector.addEventListener('click', () => {
                sector.parentNode.classList.toggle('active');
                sector.querySelector('.NordicDetail-secteurCarret').classList.toggle('active');
            });
        });
    }
    
    function generateBulletinStationId(idStation, nomAssoc) 
    {
        var request = new XMLHttpRequest();
        request.open('GET', nordic_widget_option.url + nordic_widget_option.action_bulletin + idStation + '/' + nomAssoc, true);
        request.onload = function () {
            if (request.status >= 200 && request.status < 400) {
    
                var myelement = document.getElementById('NordicMarqueBlanche');
                myelement.innerHTML = request.response
                handlersStation();
            }
        };
        request.onerror = function () {
            console.log('Error in Processing-----' + request.onerror);
        };
        request.send();
    }
    
    function generateBulletinAssociation(nomAssoc) 
    {
        var request = new XMLHttpRequest();
        request.open('GET', nordic_widget_option.url + nordic_widget_option.action_association + nomAssoc, true);
        request.onload = function () {
            if (request.status >= 200 && request.status < 400) {
    
                var myelement = document.getElementById('NordicMarqueBlanche');
                myelement.innerHTML = request.response
            }
        };
        request.onerror = function () {
            console.log('Error in Processing-----' + request.onerror);
        };
        request.send();
    }
    
    function generateBulletinStation(id) 
    {
        var request = new XMLHttpRequest();
        request.open('GET', nordic_widget_option.url + nordic_widget_option.action_station + id, true);
        request.onload = function () {
            if (request.status >= 200 && request.status < 400) {
    
                var myelement = document.getElementById('NordicMarqueBlanche');
                let myelementClass = document.getElementsByClassName('NordicMarqueBlanche-'+id);
                if(myelementClass.length>0){
                    myelement = myelementClass[0] ;
                }
                myelement.innerHTML = request.response;
            }
        }
        request.onerror = function () {
            console.log('Error in Processing-----' + request.onerror);
        };
        request.send();
    }

    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(function(){ handlersStation(); }, 1000);
    });
    